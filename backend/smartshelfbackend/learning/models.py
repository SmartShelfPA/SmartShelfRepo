import hashlib
import json
import re
import uuid

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.utils import timezone

from users.models import Organization
from users.tenant import OrganizationScopedManager
from learning.storage import protected_pdf_storage


def protected_pdf_upload_to(instance, filename: str) -> str:
    """Opaque, unguessable path inside the protected (non-public) storage root."""
    return f"protected_pdfs/{uuid.uuid4().hex}.pdf"


class ExamShelf(models.TextChoices):
    WAEC = "WAEC", "WAEC"
    JAMB = "JAMB", "JAMB"


class IgcsEpubBook(models.Model):
    """Catalog entry for an IGCSE EPUB textbook (URLs or uploaded files)."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name="igcse_epub_books",
        null=True,
        blank=True,
        help_text="Null = available to all organizations.",
    )
    title = models.CharField(max_length=255)
    subject = models.CharField(max_length=120)
    author = models.CharField(max_length=255, blank=True)
    description = models.TextField(blank=True)
    cover_image_url = models.URLField(blank=True)
    epub_url = models.URLField(
        blank=True,
        help_text="Direct HTTPS link to an .epub file (e.g. Gutenberg cache URL).",
    )
    epub_file = models.FileField(
        upload_to="igcse/epubs/",
        blank=True,
        help_text="Upload an .epub, or leave empty and use Import source URL below.",
    )
    import_source_url = models.URLField(
        blank=True,
        help_text=(
            "epub.pub / readanybook.com page or remote EPUB archive URL — "
            "downloaded on save via epub_downloader (see learning admin help)."
        ),
    )
    # Optional precomputed navigation for mobile TOC when extraction is done offline/admin-side.
    toc_json = models.JSONField(default=list, blank=True)
    extra_metadata = models.JSONField(default=dict, blank=True)
    is_active = models.BooleanField(default=True)

    # ── Content rights / licensing ──────────────────────────────────────────
    class LicenseType(models.TextChoices):
        PUBLIC_DOMAIN = "public_domain", "Public Domain"
        LICENSED = "licensed", "Licensed (permission granted)"
        RESTRICTED = "restricted", "Restricted (do not distribute)"
        UNKNOWN = "unknown", "Unknown — needs review"

    class RightsStatus(models.TextChoices):
        APPROVED = "approved", "Approved for distribution"
        DRAFT = "draft", "Draft — not yet approved"
        EXPIRED = "expired", "License expired"
        RESTRICTED = "restricted", "Restricted — internal use only"
        UNKNOWN = "unknown", "Unknown — needs review"

    license_type = models.CharField(
        max_length=20,
        choices=LicenseType.choices,
        default=LicenseType.UNKNOWN,
        help_text="Type of license that permits distribution of this content.",
    )
    rights_status = models.CharField(
        max_length=20,
        choices=RightsStatus.choices,
        default=RightsStatus.DRAFT,
        help_text="Current approval/publishing state. Only 'approved' content should be production-visible.",
    )
    content_source = models.CharField(
        max_length=512, blank=True,
        help_text="Attribution or source URL for the content (e.g. Project Gutenberg, publisher name).",
    )
    rights_notes = models.TextField(
        blank=True,
        help_text="Admin notes on licensing, permissions, or review history.",
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = OrganizationScopedManager()

    class Meta:
        ordering = ["title"]

    def clean(self) -> None:
        super().clean()
        if not self.epub_url and not self.epub_file:
            raise ValidationError("Provide either epub_url or epub_file.")
        if self.epub_url:
            url = self.epub_url.strip().lower()
            if re.search(r"\.html?(?:\?|#|$)", url):
                raise ValidationError(
                    {
                        "epub_url": "Must link to an .epub file, not an HTML page (e.g. use …/pg123-images-3.epub)."
                    }
                )
            if "gutenberg.org/ebooks/" in url and "/cache/epub/" not in url:
                raise ValidationError(
                    {
                        "epub_url": (
                            "Gutenberg landing URLs are not direct EPUB files. "
                            "Use https://www.gutenberg.org/cache/epub/<id>/pg<id>-images-3.epub"
                        )
                    }
                )

    def __str__(self) -> str:
        return self.title


class IgcsUserReading(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        Organization, on_delete=models.CASCADE, related_name="igcse_readings"
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="igcse_readings"
    )
    book = models.ForeignKey(IgcsEpubBook, on_delete=models.CASCADE, related_name="user_readings")
    fraction = models.FloatField(default=0.0, help_text="0..1 overall progress.")
    start_cfi = models.CharField(max_length=512, blank=True)
    last_read_at = models.DateTimeField(auto_now=True)

    objects = OrganizationScopedManager()

    class Meta:
        unique_together = ("user", "book")
        ordering = ["-last_read_at"]

    def save(self, *args, **kwargs):
        if self.user_id:
            self.organization_id = self.user.organization_id
        super().save(*args, **kwargs)

    @property
    def progress_percent(self) -> float:
        return round(max(0.0, min(1.0, self.fraction)) * 100, 2)


class IgcsBookmark(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        Organization, on_delete=models.CASCADE, related_name="igcse_bookmarks"
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="igcse_bookmarks"
    )
    book = models.ForeignKey(IgcsEpubBook, on_delete=models.CASCADE, related_name="bookmarks")
    label = models.CharField(max_length=255)
    start_cfi = models.CharField(max_length=512, blank=True)
    end_cfi = models.CharField(max_length=512, blank=True)
    chapter_href = models.CharField(max_length=512, blank=True)
    excerpt = models.CharField(max_length=512, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    objects = OrganizationScopedManager()

    class Meta:
        ordering = ["-created_at"]

    def save(self, *args, **kwargs):
        if self.user_id:
            self.organization_id = self.user.organization_id
        super().save(*args, **kwargs)


class IgcsHighlight(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        Organization, on_delete=models.CASCADE, related_name="igcse_highlights"
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="igcse_highlights"
    )
    book = models.ForeignKey(IgcsEpubBook, on_delete=models.CASCADE, related_name="highlights")
    color = models.CharField(max_length=32, default="#FFD54F")
    start_cfi = models.CharField(max_length=512, blank=True)
    end_cfi = models.CharField(max_length=512, blank=True)
    chapter_href = models.CharField(max_length=512, blank=True)
    excerpt = models.CharField(max_length=512, blank=True)
    fallback_note = models.CharField(max_length=512, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    objects = OrganizationScopedManager()

    class Meta:
        ordering = ["-created_at"]

    def save(self, *args, **kwargs):
        if self.user_id:
            self.organization_id = self.user.organization_id
        super().save(*args, **kwargs)


class IgcsNote(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        Organization, on_delete=models.CASCADE, related_name="igcse_notes"
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="igcse_notes"
    )
    book = models.ForeignKey(IgcsEpubBook, on_delete=models.CASCADE, related_name="notes")
    body = models.TextField()
    start_cfi = models.CharField(max_length=512, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = OrganizationScopedManager()

    class Meta:
        ordering = ["-updated_at"]

    def save(self, *args, **kwargs):
        if self.user_id:
            self.organization_id = self.user.organization_id
        super().save(*args, **kwargs)


class PracticeSession(models.Model):
    class Status(models.TextChoices):
        IN_PROGRESS = "in_progress", "In progress"
        COMPLETED = "completed", "Completed"
        ABANDONED = "abandoned", "Abandoned"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        Organization, on_delete=models.CASCADE, related_name="practice_sessions"
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="practice_sessions"
    )
    exam_type = models.CharField(max_length=8, choices=ExamShelf.choices)
    subject = models.CharField(max_length=120)
    year = models.PositiveIntegerField(null=True, blank=True)
    status = models.CharField(
        max_length=20, choices=Status.choices, default=Status.IN_PROGRESS
    )
    score_percent = models.FloatField(default=0.0)
    correct_count = models.PositiveIntegerField(default=0)
    answered_count = models.PositiveIntegerField(default=0)
    duration_seconds = models.PositiveIntegerField(null=True, blank=True)
    started_at = models.DateTimeField(auto_now_add=True)
    ended_at = models.DateTimeField(null=True, blank=True)

    objects = OrganizationScopedManager()

    class Meta:
        ordering = ["-started_at"]

    def save(self, *args, **kwargs):
        if self.user_id:
            self.organization_id = self.user.organization_id
        super().save(*args, **kwargs)


class PracticeResponse(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    session = models.ForeignKey(
        PracticeSession, on_delete=models.CASCADE, related_name="responses"
    )
    question_id = models.CharField(max_length=128)
    selected_option_id = models.CharField(max_length=64, blank=True)
    correct_option_id = models.CharField(max_length=64, blank=True)
    is_correct = models.BooleanField(default=False)
    order_index = models.PositiveIntegerField(default=0)
    time_spent_ms = models.PositiveIntegerField(null=True, blank=True)

    class Meta:
        ordering = ["order_index", "id"]


class CachedNormalizedQuestion(models.Model):
    """Short-lived cache of normalized question payloads keyed by provider + external identity."""

    provider = models.CharField(max_length=64)
    exam_type = models.CharField(max_length=8, choices=ExamShelf.choices)
    subject = models.CharField(max_length=120)
    year = models.PositiveIntegerField(default=0)
    external_id = models.CharField(max_length=128)
    cache_key = models.CharField(max_length=64, unique=True, db_index=True)
    payload = models.JSONField()
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()

    class Meta:
        indexes = [
            models.Index(fields=["provider", "exam_type", "subject", "year"]),
        ]

    @staticmethod
    def make_cache_key(provider: str, exam_type: str, subject: str, year: int, external_id: str) -> str:
        raw = f"{provider}|{exam_type}|{subject}|{year}|{external_id}"
        return hashlib.sha256(raw.encode("utf-8")).hexdigest()

    @classmethod
    def upsert_payload(
        cls,
        *,
        provider: str,
        exam_type: str,
        subject: str,
        year: int,
        external_id: str,
        payload: dict,
        ttl_seconds: int = 3600,
    ) -> "CachedNormalizedQuestion":
        key = cls.make_cache_key(provider, exam_type, subject, year, external_id)
        expires_at = timezone.now() + timezone.timedelta(seconds=ttl_seconds)
        obj, _created = cls.objects.update_or_create(
            cache_key=key,
            defaults={
                "provider": provider,
                "exam_type": exam_type,
                "subject": subject,
                "year": year,
                "external_id": external_id,
                "payload": payload,
                "expires_at": expires_at,
            },
        )
        return obj

    @classmethod
    def prune_expired(cls) -> int:
        deleted, _ = cls.objects.filter(expires_at__lt=timezone.now()).delete()
        return deleted


def default_question_payload() -> dict:
    return {}


class QuestionCacheBatch(models.Model):
    """Stores a full normalized list for a (provider, exam, subject, year) fetch."""

    provider = models.CharField(max_length=64)
    exam_type = models.CharField(max_length=8, choices=ExamShelf.choices)
    subject = models.CharField(max_length=120)
    year = models.PositiveIntegerField(default=0)
    batch_key = models.CharField(max_length=64, unique=True, db_index=True)
    questions_json = models.JSONField(default=list)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()

    class Meta:
        indexes = [
            models.Index(fields=["provider", "exam_type", "subject", "year"]),
        ]

    @staticmethod
    def make_batch_key(provider: str, exam_type: str, subject: str, year: int) -> str:
        raw = f"{provider}|batch|{exam_type}|{subject}|{year}"
        return hashlib.sha256(raw.encode("utf-8")).hexdigest()


class ProtectedPdfAsset(models.Model):
    """
    A rights-managed IGCSE PDF that is only ever delivered through SmartShelf
    via short-lived signed download tokens (never a permanent public URL).

    The raw file is stored in ``settings.PROTECTED_MEDIA_ROOT`` (outside
    ``MEDIA_ROOT``) using :class:`learning.storage.ProtectedPdfStorage`.
    """

    class AccessLevel(models.TextChoices):
        AUTHENTICATED = "authenticated", "Any signed-in user"
        ORGANIZATION = "organization", "Same organization only"
        STAFF = "staff", "Staff / publishers only"

    class RightsStatus(models.TextChoices):
        APPROVED = "approved", "Approved for distribution"
        DRAFT = "draft", "Draft — not yet approved"
        EXPIRED = "expired", "License expired"
        RESTRICTED = "restricted", "Restricted — internal use only"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name="protected_pdfs",
        null=True,
        blank=True,
        help_text="Null = available to all organizations (subject to access_level).",
    )
    title = models.CharField(max_length=255)
    subject = models.CharField(max_length=120, blank=True)
    chapter = models.CharField(
        max_length=255, blank=True, help_text="Optional chapter/topic linkage."
    )
    description = models.TextField(blank=True)
    cover_image_url = models.URLField(blank=True)

    pdf_file = models.FileField(
        upload_to=protected_pdf_upload_to,
        storage=protected_pdf_storage,
        help_text="The protected PDF. Stored outside the public media root.",
    )
    file_size_bytes = models.PositiveBigIntegerField(default=0, editable=False)

    published = models.BooleanField(
        default=False,
        help_text="Only published assets are listed and downloadable.",
    )
    rights_status = models.CharField(
        max_length=20,
        choices=RightsStatus.choices,
        default=RightsStatus.DRAFT,
        help_text="Only 'approved' content is downloadable, regardless of published flag.",
    )
    access_level = models.CharField(
        max_length=20,
        choices=AccessLevel.choices,
        default=AccessLevel.AUTHENTICATED,
    )
    # Bumping this invalidates offline copies on the next online open
    # (the app compares it against the value stored at download time).
    rights_version = models.PositiveIntegerField(
        default=1,
        help_text="Increment to force clients to re-authorize cached copies.",
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = OrganizationScopedManager()

    class Meta:
        ordering = ["title"]
        indexes = [
            models.Index(fields=["published", "rights_status"], name="learning_pr_publish_idx"),
        ]

    def __str__(self) -> str:
        return self.title

    def save(self, *args, **kwargs):
        try:
            if self.pdf_file and hasattr(self.pdf_file, "size"):
                self.file_size_bytes = self.pdf_file.size or 0
        except (OSError, ValueError):
            pass
        super().save(*args, **kwargs)

    @property
    def is_downloadable(self) -> bool:
        return self.published and self.rights_status == self.RightsStatus.APPROVED

    def user_can_access(self, user) -> bool:
        """Authorization check used by the authorize-download endpoint."""
        if not self.is_downloadable:
            return False
        if not getattr(user, "is_authenticated", False):
            return False

        if self.access_level == self.AccessLevel.STAFF:
            if not (user.is_staff or getattr(user, "role", "") in ("staff", "publisher")):
                return False

        # Organization scoping: null org = global; otherwise must match.
        if self.organization_id is not None:
            if getattr(user, "organization_id", None) != self.organization_id:
                return False

        return True


class ProtectedPdfAccessLog(models.Model):
    """Audit trail of authorize / download events for protected PDFs."""

    class Event(models.TextChoices):
        AUTHORIZED = "authorized", "Download authorized"
        DOWNLOADED = "downloaded", "File streamed"
        DENIED = "denied", "Access denied"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    asset = models.ForeignKey(
        ProtectedPdfAsset, on_delete=models.CASCADE, related_name="access_logs"
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="protected_pdf_access",
    )
    event = models.CharField(max_length=20, choices=Event.choices)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    notes = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["asset", "event"], name="learning_pr_asset_evt_idx"),
            models.Index(fields=["user", "created_at"], name="learning_pr_user_dt_idx"),
        ]

    def __str__(self) -> str:
        return f"{self.get_event_display()} · {self.asset_id} · {self.created_at:%Y-%m-%d %H:%M}"
