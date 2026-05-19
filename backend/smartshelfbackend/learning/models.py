import hashlib
import json
import uuid

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.utils import timezone

from users.models import Organization
from users.tenant import OrganizationScopedManager


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
    epub_url = models.URLField(blank=True)
    epub_file = models.FileField(upload_to="igcse/epubs/", blank=True)
    # Optional precomputed navigation for mobile TOC when extraction is done offline/admin-side.
    toc_json = models.JSONField(default=list, blank=True)
    extra_metadata = models.JSONField(default=dict, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = OrganizationScopedManager()

    class Meta:
        ordering = ["title"]

    def clean(self) -> None:
        super().clean()
        if not self.epub_url and not self.epub_file:
            raise ValidationError("Provide either epub_url or epub_file.")

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
