from __future__ import annotations

import json

from django import forms

from igcse_catalog.models import GenerationStatus, IGCSEGeneratedSet


class ManifestImportForm(forms.Form):
    """Upload a study-agent manifest JSON file (same schema as ingest_igcse_set command)."""

    manifest_file = forms.FileField(
        help_text="JSON object with subject_slug, chapter_slug, practice_paper, worked_solutions, simulator, etc."
    )
    source_folder = forms.CharField(
        required=False,
        widget=forms.TextInput(attrs={"size": 80}),
        help_text="Optional absolute path on the server for relative pdf_path / artifact_path entries.",
    )
    publish_after_ingest = forms.BooleanField(
        initial=True,
        required=False,
        label="Publish immediately and mark as latest",
    )


class IGCSEGeneratedSetAdminForm(forms.ModelForm):
    class Meta:
        model = IGCSEGeneratedSet
        fields = "__all__"

    def clean(self):
        cleaned = super().clean()
        is_published = cleaned.get("is_published")
        status = cleaned.get("generation_status")
        if is_published and status == GenerationStatus.FAILED:
            raise forms.ValidationError("Cannot publish a set with generation_status=failed.")
        return cleaned


def parse_manifest_upload(uploaded_file) -> dict:
    try:
        raw = uploaded_file.read()
        if isinstance(raw, bytes):
            raw = raw.decode("utf-8")
        data = json.loads(raw)
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise forms.ValidationError(f"Invalid manifest JSON: {exc}") from exc
    if not isinstance(data, dict):
        raise forms.ValidationError("Manifest root must be a JSON object.")
    return data
