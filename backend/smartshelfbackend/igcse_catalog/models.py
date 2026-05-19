from __future__ import annotations

import uuid

from django.core.exceptions import ValidationError
from django.db import models


class GenerationStatus(models.TextChoices):
    PENDING = "pending", "Pending"
    READY = "ready", "Ready"
    FAILED = "failed", "Failed"
    PUBLISHED = "published", "Published"


class IGCSESubject(models.Model):
    """Top-level IGCSE subject (study-agent syllabus area)."""

    slug = models.SlugField(max_length=96, unique=True)
    title = models.CharField(max_length=255)
    display_order = models.PositiveIntegerField(default=0)
    is_published = models.BooleanField(default=False)
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["display_order", "title"]

    def __str__(self) -> str:
        return self.title


class IGCSEChapter(models.Model):
    """Chapter within a subject — maps to one generated content set target."""

    subject = models.ForeignKey(
        IGCSESubject,
        on_delete=models.CASCADE,
        related_name="chapters",
    )
    slug = models.SlugField(max_length=96)
    title = models.CharField(max_length=255)
    display_order = models.PositiveIntegerField(default=0)
    is_published = models.BooleanField(default=False)
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["display_order", "title"]
        constraints = [
            models.UniqueConstraint(
                fields=["subject", "slug"],
                name="igcse_catalog_chapter_subject_slug_uniq",
            )
        ]

    def __str__(self) -> str:
        return f"{self.subject.slug}/{self.slug}"


class IGCSEGeneratedSet(models.Model):
    """
    One study-agent generation bundle for a chapter: practice paper, solutions, simulator.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    chapter = models.ForeignKey(
        IGCSEChapter,
        on_delete=models.CASCADE,
        related_name="generated_sets",
    )
    generated_at = models.DateTimeField()
    is_published = models.BooleanField(default=False)
    generation_status = models.CharField(
        max_length=20,
        choices=GenerationStatus.choices,
        default=GenerationStatus.PENDING,
    )
    quality_score = models.FloatField(
        null=True,
        blank=True,
        help_text="Optional 0..1 quality score from the pipeline.",
    )
    pipeline_bundle_id = models.CharField(max_length=128, blank=True, db_index=True)
    version = models.PositiveIntegerField(
        default=1,
        help_text="Monotonic version per chapter when the pipeline re-generates content.",
    )
    is_latest_published = models.BooleanField(
        default=False,
        help_text="When true, this set is the canonical published release for its chapter.",
    )
    generation_metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-generated_at", "-created_at"]
        indexes = [
            models.Index(fields=["chapter", "is_published", "-generated_at"]),
            models.Index(fields=["chapter", "is_latest_published"]),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["chapter", "pipeline_bundle_id"],
                condition=models.Q(pipeline_bundle_id__gt=""),
                name="igcse_catalog_chapter_bundle_uniq",
            ),
            models.UniqueConstraint(
                fields=["chapter", "version"],
                name="igcse_catalog_chapter_version_uniq",
            ),
        ]

    @property
    def subject_slug(self) -> str:
        return self.chapter.subject.slug

    @property
    def chapter_slug(self) -> str:
        return self.chapter.slug

    @property
    def chapter_title(self) -> str:
        return self.chapter.title

    def __str__(self) -> str:
        return f"{self.subject_slug}/{self.chapter_slug} @ {self.generated_at:%Y-%m-%d}"


class PracticePaperAsset(models.Model):
    generated_set = models.OneToOneField(
        IGCSEGeneratedSet,
        on_delete=models.CASCADE,
        related_name="practice_paper",
    )
    pdf_file = models.FileField(upload_to="igcse/papers/", blank=True)
    pdf_url = models.URLField(blank=True)
    sha256 = models.CharField(max_length=64, blank=True)
    page_count = models.PositiveIntegerField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def clean(self) -> None:
        super().clean()
        if not self.pdf_file and not self.pdf_url:
            raise ValidationError("Provide pdf_file or pdf_url for the practice paper.")

    def __str__(self) -> str:
        return f"Practice paper ({self.generated_set_id})"


class WorkedSolutionsAsset(models.Model):
    generated_set = models.OneToOneField(
        IGCSEGeneratedSet,
        on_delete=models.CASCADE,
        related_name="worked_solutions",
    )
    pdf_file = models.FileField(upload_to="igcse/solutions/", blank=True)
    pdf_url = models.URLField(blank=True)
    sha256 = models.CharField(max_length=64, blank=True)
    page_count = models.PositiveIntegerField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def clean(self) -> None:
        super().clean()
        if not self.pdf_file and not self.pdf_url:
            raise ValidationError("Provide pdf_file or pdf_url for worked solutions.")

    def __str__(self) -> str:
        return f"Worked solutions ({self.generated_set_id})"


class SimulatorSet(models.Model):
    generated_set = models.OneToOneField(
        IGCSEGeneratedSet,
        on_delete=models.CASCADE,
        related_name="simulator",
    )
    simulator_set_id = models.CharField(max_length=128, db_index=True)
    public_url = models.URLField(blank=True)
    artifact_file = models.FileField(upload_to="igcse/simulators/", blank=True)
    artifact_url = models.URLField(blank=True)
    artifact_json = models.JSONField(default=dict, blank=True)
    schema_version = models.CharField(max_length=32, blank=True)
    build_id = models.CharField(max_length=128, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def clean(self) -> None:
        super().clean()
        has_delivery = bool(
            self.public_url
            or self.artifact_url
            or self.artifact_file
            or (isinstance(self.artifact_json, dict) and self.artifact_json)
        )
        if not has_delivery:
            raise ValidationError(
                "Provide public_url, artifact_url, artifact_file, or non-empty artifact_json."
            )

    def __str__(self) -> str:
        return f"Simulator {self.simulator_set_id}"
