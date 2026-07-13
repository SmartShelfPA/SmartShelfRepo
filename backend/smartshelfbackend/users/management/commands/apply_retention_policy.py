"""
Management command: apply_retention_policy

Finds user accounts whose `scheduled_deletion_at` has passed and anonymizes
them by blanking PII fields and deactivating the account.

Intended to be run on a schedule (e.g. daily via cron or Celery beat):

    python manage.py apply_retention_policy

Options:
    --dry-run   Print what would be anonymized without making any changes.
    --batch N   Process at most N accounts per run (default: 500).

Exit codes:
    0 — success (even if 0 accounts processed)
    1 — unhandled error
"""

from django.core.management.base import BaseCommand
from django.utils import timezone

from users.models import AuditLog, UserProfile


class Command(BaseCommand):
    help = "Anonymize user accounts whose scheduled_deletion_at has passed."

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            default=False,
            help="List accounts that would be anonymized without modifying them.",
        )
        parser.add_argument(
            "--batch",
            type=int,
            default=500,
            help="Maximum number of accounts to process per run (default: 500).",
        )

    def handle(self, *args, **options):
        dry_run: bool = options["dry_run"]
        batch: int = options["batch"]
        now = timezone.now()

        due = UserProfile.objects.filter(
            scheduled_deletion_at__lte=now,
            is_active=True,
        )[:batch]

        count = due.count()
        if count == 0:
            self.stdout.write(self.style.SUCCESS("No accounts due for anonymization."))
            return

        self.stdout.write(
            f"{'[DRY RUN] ' if dry_run else ''}Found {count} account(s) due for anonymization."
        )

        anonymized = 0
        errors = 0
        for user in due:
            self.stdout.write(
                f"  {'Would anonymize' if dry_run else 'Anonymizing'}: "
                f"{user.username} (id={user.id}, scheduled={user.scheduled_deletion_at})"
            )
            if dry_run:
                continue
            try:
                uid = str(user.id)[:8]
                user.email = f"deleted_{uid}@anonymized.invalid"
                user.full_name = "Deleted User"
                user.username = f"deleted_{uid}"
                user.date_of_birth = None
                user.avatar_url = ""
                user.analytics_consent = False
                user.is_active = False
                user.scheduled_deletion_at = None
                user.save()
                AuditLog.log(
                    AuditLog.Action.DATA_DELETE,
                    actor=None,
                    target=user,
                    notes="Account anonymized by apply_retention_policy management command.",
                )
                anonymized += 1
            except Exception as exc:  # noqa: BLE001
                self.stderr.write(f"  ERROR anonymizing {user.id}: {exc}")
                errors += 1

        if not dry_run:
            self.stdout.write(
                self.style.SUCCESS(
                    f"Done. Anonymized: {anonymized}, Errors: {errors}."
                )
            )
