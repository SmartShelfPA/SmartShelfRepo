import uuid

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion

import learning.models
import learning.storage


def seed_bundled_pdfs(apps, schema_editor):
    """Import any PDFs from bundled-igcse/manifest.json as protected assets.

    Defensive: no-ops if the manifest or files are missing so the migration is
    safe on any machine / CI without the bundled files present.
    """
    import json
    from pathlib import Path

    from django.core.files.base import ContentFile

    ProtectedPdfAsset = apps.get_model("learning", "ProtectedPdfAsset")

    manifest_path = Path(
        getattr(settings, "BUNDLED_IGCSE_MANIFEST", "")
        or (Path(settings.BASE_DIR).parent.parent / "bundled-igcse" / "manifest.json")
    )
    if not manifest_path.is_file():
        return

    try:
        entries = json.loads(manifest_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return
    if not isinstance(entries, list):
        return

    pdf_dir = manifest_path.parent / "pdfs"

    for item in entries:
        if not isinstance(item, dict):
            continue
        if str(item.get("type") or "").lower() != "pdf":
            continue
        filename = str(item.get("filename") or "").strip()
        title = str(item.get("title") or "").strip() or "Untitled PDF"
        if not filename or ".." in filename or "/" in filename or "\\" in filename:
            continue
        src = pdf_dir / filename
        if not src.is_file():
            continue
        if ProtectedPdfAsset.objects.filter(title=title).exists():
            continue

        asset = ProtectedPdfAsset(
            title=title,
            subject=str(item.get("subject") or ""),
            description=str(item.get("description") or ""),
            published=True,
            rights_status="approved",
            access_level="authenticated",
            rights_version=1,
        )
        try:
            data = src.read_bytes()
        except OSError:
            continue
        asset.pdf_file.save(f"{uuid.uuid4().hex}.pdf", ContentFile(data), save=False)
        asset.file_size_bytes = len(data)
        asset.save()


def unseed(apps, schema_editor):
    # Intentionally a no-op: we don't delete admin-managed content on reverse.
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("learning", "0003_compliance_content_license"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("users", "0001_initial"),
    ]

    operations = [
        migrations.CreateModel(
            name="ProtectedPdfAsset",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("title", models.CharField(max_length=255)),
                ("subject", models.CharField(blank=True, max_length=120)),
                ("chapter", models.CharField(blank=True, help_text="Optional chapter/topic linkage.", max_length=255)),
                ("description", models.TextField(blank=True)),
                ("cover_image_url", models.URLField(blank=True)),
                (
                    "pdf_file",
                    models.FileField(
                        help_text="The protected PDF. Stored outside the public media root.",
                        storage=learning.storage.ProtectedPdfStorage(),
                        upload_to=learning.models.protected_pdf_upload_to,
                    ),
                ),
                ("file_size_bytes", models.PositiveBigIntegerField(default=0, editable=False)),
                ("published", models.BooleanField(default=False, help_text="Only published assets are listed and downloadable.")),
                (
                    "rights_status",
                    models.CharField(
                        choices=[
                            ("approved", "Approved for distribution"),
                            ("draft", "Draft — not yet approved"),
                            ("expired", "License expired"),
                            ("restricted", "Restricted — internal use only"),
                        ],
                        default="draft",
                        help_text="Only 'approved' content is downloadable, regardless of published flag.",
                        max_length=20,
                    ),
                ),
                (
                    "access_level",
                    models.CharField(
                        choices=[
                            ("authenticated", "Any signed-in user"),
                            ("organization", "Same organization only"),
                            ("staff", "Staff / publishers only"),
                        ],
                        default="authenticated",
                        max_length=20,
                    ),
                ),
                ("rights_version", models.PositiveIntegerField(default=1, help_text="Increment to force clients to re-authorize cached copies.")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "organization",
                    models.ForeignKey(
                        blank=True,
                        help_text="Null = available to all organizations (subject to access_level).",
                        null=True,
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="protected_pdfs",
                        to="users.organization",
                    ),
                ),
            ],
            options={
                "ordering": ["title"],
            },
        ),
        migrations.CreateModel(
            name="ProtectedPdfAccessLog",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                (
                    "event",
                    models.CharField(
                        choices=[
                            ("authorized", "Download authorized"),
                            ("downloaded", "File streamed"),
                            ("denied", "Access denied"),
                        ],
                        max_length=20,
                    ),
                ),
                ("ip_address", models.GenericIPAddressField(blank=True, null=True)),
                ("notes", models.CharField(blank=True, max_length=255)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "asset",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="access_logs",
                        to="learning.protectedpdfasset",
                    ),
                ),
                (
                    "user",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="protected_pdf_access",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "ordering": ["-created_at"],
            },
        ),
        migrations.AddIndex(
            model_name="protectedpdfasset",
            index=models.Index(fields=["published", "rights_status"], name="learning_pr_publish_idx"),
        ),
        migrations.AddIndex(
            model_name="protectedpdfaccesslog",
            index=models.Index(fields=["asset", "event"], name="learning_pr_asset_evt_idx"),
        ),
        migrations.AddIndex(
            model_name="protectedpdfaccesslog",
            index=models.Index(fields=["user", "created_at"], name="learning_pr_user_dt_idx"),
        ),
        migrations.RunPython(seed_bundled_pdfs, unseed),
    ]
