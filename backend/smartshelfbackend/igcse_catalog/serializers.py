from __future__ import annotations

from django.core.validators import RegexValidator
from rest_framework import serializers

from igcse_catalog.models import GenerationStatus

_slug_valid = RegexValidator(
    regex=r"^[a-z0-9_-]{1,96}$",
    message="Use URL-safe slugs: lowercase letters, digits, underscores, and hyphens.",
)


class SubjectSlugQuerySerializer(serializers.Serializer):
    subject = serializers.CharField(max_length=96, validators=[_slug_valid])

    def validate_subject(self, value: str) -> str:
        return value.strip().lower()


class SetsListQuerySerializer(serializers.Serializer):
    subject = serializers.CharField(
        max_length=96, required=False, allow_blank=True, validators=[_slug_valid]
    )
    chapter = serializers.CharField(
        max_length=96, required=False, allow_blank=True, validators=[_slug_valid]
    )

    def validated_subject(self) -> str | None:
        raw = str(self.validated_data.get("subject") or "").strip()
        return raw.lower() if raw else None

    def validated_chapter(self) -> str | None:
        raw = str(self.validated_data.get("chapter") or "").strip()
        return raw.lower() if raw else None


class PracticePaperIngestSerializer(serializers.Serializer):
    pdf_url = serializers.URLField(required=False, allow_blank=True, default="")
    pdf_path = serializers.CharField(required=False, allow_blank=True, max_length=512, default="")
    sha256 = serializers.CharField(required=False, allow_blank=True, max_length=64, default="")
    page_count = serializers.IntegerField(required=False, min_value=1, allow_null=True)


class WorkedSolutionsIngestSerializer(serializers.Serializer):
    pdf_url = serializers.URLField(required=False, allow_blank=True, default="")
    pdf_path = serializers.CharField(required=False, allow_blank=True, max_length=512, default="")
    sha256 = serializers.CharField(required=False, allow_blank=True, max_length=64, default="")
    page_count = serializers.IntegerField(required=False, min_value=1, allow_null=True)


class SimulatorIngestSerializer(serializers.Serializer):
    simulator_set_id = serializers.CharField(max_length=128)
    public_url = serializers.URLField(required=False, allow_blank=True, default="")
    artifact_url = serializers.URLField(required=False, allow_blank=True, default="")
    artifact_path = serializers.CharField(required=False, allow_blank=True, max_length=512, default="")
    artifact_json = serializers.JSONField(required=False, default=dict)
    schema_version = serializers.CharField(required=False, allow_blank=True, max_length=32, default="")
    build_id = serializers.CharField(required=False, allow_blank=True, max_length=128, default="")


class GeneratedSetIngestSerializer(serializers.Serializer):
    subject_slug = serializers.CharField(max_length=96, validators=[_slug_valid])
    chapter_slug = serializers.CharField(max_length=96, validators=[_slug_valid])
    subject_title = serializers.CharField(max_length=255, required=False, allow_blank=True)
    chapter_title = serializers.CharField(max_length=255, required=False, allow_blank=True)
    generated_at = serializers.DateTimeField(required=False)
    is_published = serializers.BooleanField(default=False)
    publish_subject = serializers.BooleanField(required=False)
    publish_chapter = serializers.BooleanField(required=False)
    generation_status = serializers.ChoiceField(
        choices=GenerationStatus.choices,
        required=False,
    )
    quality_score = serializers.FloatField(required=False, min_value=0.0, max_value=1.0)
    pipeline_bundle_id = serializers.CharField(required=False, allow_blank=True, max_length=128)
    version = serializers.IntegerField(required=False, min_value=1)
    on_duplicate = serializers.ChoiceField(
        choices=["upsert", "reject", "version"],
        required=False,
    )
    allow_new_version = serializers.BooleanField(required=False, default=False)
    publish_as_latest = serializers.BooleanField(required=False, default=False)
    create_if_missing = serializers.BooleanField(required=False, default=True)
    source_folder = serializers.CharField(required=False, allow_blank=True, max_length=512)
    generation_metadata = serializers.JSONField(required=False, default=dict)
    practice_paper = PracticePaperIngestSerializer()
    worked_solutions = WorkedSolutionsIngestSerializer()
    simulator = SimulatorIngestSerializer()

    def validate_subject_slug(self, value: str) -> str:
        return value.strip().lower()

    def validate_chapter_slug(self, value: str) -> str:
        return value.strip().lower()
