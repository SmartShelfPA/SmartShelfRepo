from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any, Literal

from django.db import transaction
from django.db.models import Max
from django.utils import timezone
from django.utils.dateparse import parse_datetime

from igcse_catalog.exceptions import IngestDuplicateError, IngestValidationError
from igcse_catalog.models import (
    GenerationStatus,
    IGCSEChapter,
    IGCSEGeneratedSet,
    IGCSESubject,
    PracticePaperAsset,
    SimulatorSet,
    WorkedSolutionsAsset,
)
from igcse_catalog.services.storage import (
    resolve_path_under_source_dir,
    save_local_file_to_storage,
    sha256_file,
)

OnDuplicateMode = Literal["upsert", "reject", "version"]


@dataclass(frozen=True)
class IngestResult:
    generated_set: IGCSEGeneratedSet
    created: bool
    version: int


def _parse_generated_at(value: Any) -> datetime:
    if isinstance(value, datetime):
        dt = value
        if timezone.is_naive(dt):
            return timezone.make_aware(dt, timezone.get_current_timezone())
        return dt
    if isinstance(value, str) and value.strip():
        parsed = parse_datetime(value.strip())
        if parsed is not None:
            if timezone.is_naive(parsed):
                return timezone.make_aware(parsed, timezone.get_current_timezone())
            return parsed
    return timezone.now()


def _coerce_status(raw: str | None, *, is_published: bool) -> str:
    if is_published:
        return GenerationStatus.PUBLISHED
    normalized = (raw or GenerationStatus.READY).strip().lower()
    for choice in GenerationStatus:
        if choice.value == normalized:
            return choice.value
    return GenerationStatus.READY


def _default_on_duplicate(bundle_id: str, explicit: str | None) -> OnDuplicateMode:
    if explicit in ("upsert", "reject", "version"):
        return explicit  # type: ignore[return-value]
    return "upsert" if bundle_id else "reject"


def ensure_subject_and_chapter(
    *,
    subject_slug: str,
    chapter_slug: str,
    subject_title: str,
    chapter_title: str,
    publish_subject: bool | None,
    publish_chapter: bool | None,
    is_published: bool,
    create_if_missing: bool = True,
) -> tuple[IGCSESubject, IGCSEChapter]:
    subject_slug = subject_slug.strip().lower()
    chapter_slug = chapter_slug.strip().lower()

    subject = IGCSESubject.objects.filter(slug=subject_slug).first()
    if subject is None:
        if not create_if_missing:
            raise IngestValidationError(f"Subject not found: {subject_slug}")
        subject = IGCSESubject.objects.create(
            slug=subject_slug,
            title=subject_title,
            is_published=bool(publish_subject if publish_subject is not None else is_published),
        )
    else:
        if subject_title and subject.title != subject_title:
            subject.title = subject_title
        if publish_subject is not None:
            subject.is_published = publish_subject
        subject.save()

    chapter = IGCSEChapter.objects.filter(subject=subject, slug=chapter_slug).first()
    if chapter is None:
        if not create_if_missing:
            raise IngestValidationError(
                f"Chapter not found: {subject_slug}/{chapter_slug}"
            )
        chapter = IGCSEChapter.objects.create(
            subject=subject,
            slug=chapter_slug,
            title=chapter_title,
            is_published=bool(publish_chapter if publish_chapter is not None else is_published),
        )
    else:
        if chapter_title and chapter.title != chapter_title:
            chapter.title = chapter_title
        if publish_chapter is not None:
            chapter.is_published = publish_chapter
        chapter.save()

    return subject, chapter


def _next_version(chapter: IGCSEChapter) -> int:
    current = (
        IGCSEGeneratedSet.objects.filter(chapter=chapter).aggregate(m=Max("version")).get("m")
    )
    return int(current or 0) + 1


def _build_metadata(payload: dict[str, Any]) -> dict[str, Any]:
    meta = payload.get("generation_metadata")
    if not isinstance(meta, dict):
        meta = {}
    source_folder = str(payload.get("source_folder") or "").strip()
    if source_folder:
        meta = {**meta, "source_folder": source_folder}
    return meta


def mark_latest_published(generated_set: IGCSEGeneratedSet) -> None:
    """Unset previous latest flags for the chapter and mark this set as canonical."""
    IGCSEGeneratedSet.objects.filter(
        chapter_id=generated_set.chapter_id,
        is_latest_published=True,
    ).exclude(pk=generated_set.pk).update(is_latest_published=False)
    if not generated_set.is_latest_published:
        generated_set.is_latest_published = True
        generated_set.save(update_fields=["is_latest_published", "updated_at"])


def _resolve_asset_delivery(
    data: dict[str, Any],
    *,
    source_dir: Path | None,
    storage_prefix: str,
    label: str,
) -> dict[str, Any]:
    """Normalize pdf_url / pdf_path / pdf_file into fields for asset upsert."""
    out = dict(data)
    pdf_url = str(out.get("pdf_url") or "").strip()
    pdf_path = str(out.get("pdf_path") or out.get("path") or "").strip()

    local: Path | None = None
    if out.get("pdf_file") is not None:
        return out
    if pdf_path:
        local = resolve_path_under_source_dir(source_dir, pdf_path)
        if local is None:
            raise IngestValidationError(f"{label}: file not found at {pdf_path!r}")

    if local is not None:
        checksum = str(out.get("sha256") or "").strip() or sha256_file(local)
        storage_name = save_local_file_to_storage(
            local_path=local,
            storage_path=f"{storage_prefix}/{local.name}",
        )
        out["pdf_file"] = storage_name
        out["sha256"] = checksum
        out["pdf_url"] = pdf_url
    elif not pdf_url:
        raise IngestValidationError(
            f"{label}: provide pdf_url, pdf_path (with --source-dir), or pdf_file"
        )
    return out


@transaction.atomic
def ingest_generated_set(
    payload: dict[str, Any],
    *,
    source_dir: Path | None = None,
) -> IngestResult:
    """
    Register a study-agent generated chapter set.

    Keys: subject_slug, chapter_slug, practice_paper, worked_solutions, simulator,
    pipeline_bundle_id, version, on_duplicate (upsert|reject|version),
    publish_as_latest, source_folder, generation_metadata, ...
    """
    subject_slug = str(payload["subject_slug"]).strip().lower()
    chapter_slug = str(payload["chapter_slug"]).strip().lower()
    subject_title = str(
        payload.get("subject_title") or subject_slug.replace("_", " ").title()
    )
    chapter_title = str(
        payload.get("chapter_title") or chapter_slug.replace("-", " ").replace("_", " ").title()
    )

    create_if_missing = bool(payload.get("create_if_missing", True))
    is_published = bool(payload.get("is_published", False))
    publish_as_latest = bool(payload.get("publish_as_latest", is_published))

    subject, chapter = ensure_subject_and_chapter(
        subject_slug=subject_slug,
        chapter_slug=chapter_slug,
        subject_title=subject_title,
        chapter_title=chapter_title,
        publish_subject=payload.get("publish_subject"),
        publish_chapter=payload.get("publish_chapter"),
        is_published=is_published,
        create_if_missing=create_if_missing,
    )

    bundle_id = str(payload.get("pipeline_bundle_id") or "").strip()
    on_duplicate = _default_on_duplicate(bundle_id, payload.get("on_duplicate"))
    explicit_version = payload.get("version")

    generated_at = _parse_generated_at(payload.get("generated_at"))
    status = _coerce_status(payload.get("generation_status"), is_published=is_published)
    metadata = _build_metadata(payload)

    existing: IGCSEGeneratedSet | None = None
    if bundle_id:
        existing = (
            IGCSEGeneratedSet.objects.filter(chapter=chapter, pipeline_bundle_id=bundle_id)
            .select_related("practice_paper", "worked_solutions", "simulator")
            .first()
        )
        if existing and on_duplicate == "reject":
            raise IngestDuplicateError(
                f"Set already exists for bundle_id={bundle_id!r}.",
                existing_set_id=str(existing.pk),
            )

    created = False
    if existing and on_duplicate == "upsert":
        generated_set = existing
        version = int(explicit_version or existing.version)
    elif existing and on_duplicate == "version":
        generated_set = None
        version = int(explicit_version or _next_version(chapter))
    elif existing and on_duplicate == "reject":
        raise IngestDuplicateError(
            f"Set already exists for bundle_id={bundle_id!r}.",
            existing_set_id=str(existing.pk),
        )
    else:
        if not bundle_id and on_duplicate == "reject":
            dup = IGCSEGeneratedSet.objects.filter(chapter=chapter).exists()
            if dup and not payload.get("allow_new_version"):
                latest = (
                    IGCSEGeneratedSet.objects.filter(chapter=chapter)
                    .order_by("-version")
                    .first()
                )
                raise IngestDuplicateError(
                    "Chapter already has a generated set. "
                    "Set pipeline_bundle_id, on_duplicate=version, or allow_new_version=true.",
                    existing_set_id=str(latest.pk) if latest else None,
                )
        version = int(explicit_version or _next_version(chapter))
        generated_set = None

    set_fields = {
        "generated_at": generated_at,
        "is_published": is_published,
        "generation_status": status,
        "quality_score": payload.get("quality_score"),
        "pipeline_bundle_id": bundle_id,
        "generation_metadata": metadata,
        "version": version,
        "is_latest_published": False,
    }

    if generated_set is None:
        generated_set = IGCSEGeneratedSet.objects.create(chapter=chapter, **set_fields)
        created = True
    else:
        for key, val in set_fields.items():
            setattr(generated_set, key, val)
        generated_set.save()

    prefix = f"igcse/{subject_slug}/{chapter_slug}/v{generated_set.version}"
    practice_data = _resolve_asset_delivery(
        payload.get("practice_paper") or {},
        source_dir=source_dir,
        storage_prefix=f"{prefix}/papers",
        label="practice_paper",
    )
    solutions_data = _resolve_asset_delivery(
        payload.get("worked_solutions") or {},
        source_dir=source_dir,
        storage_prefix=f"{prefix}/solutions",
        label="worked_solutions",
    )
    _upsert_practice_paper(generated_set, practice_data)
    _upsert_worked_solutions(generated_set, solutions_data)
    _upsert_simulator(
        generated_set,
        payload.get("simulator") or {},
        source_dir=source_dir,
        storage_prefix=f"{prefix}/simulators",
    )

    if publish_as_latest and is_published:
        mark_latest_published(generated_set)

    loaded = (
        IGCSEGeneratedSet.objects.select_related(
            "chapter",
            "chapter__subject",
            "practice_paper",
            "worked_solutions",
            "simulator",
        )
        .get(pk=generated_set.pk)
    )
    return IngestResult(generated_set=loaded, created=created, version=loaded.version)


def _upsert_practice_paper(generated_set: IGCSEGeneratedSet, data: dict[str, Any]) -> PracticePaperAsset:
    defaults = {
        "pdf_url": str(data.get("pdf_url") or "").strip(),
        "sha256": str(data.get("sha256") or "").strip(),
        "page_count": data.get("page_count"),
    }
    asset, was_created = PracticePaperAsset.objects.get_or_create(
        generated_set=generated_set,
        defaults=defaults,
    )
    if not was_created:
        for key, val in defaults.items():
            setattr(asset, key, val)
    if data.get("pdf_file") is not None:
        asset.pdf_file = data["pdf_file"]
    asset.save()
    return asset


def _upsert_worked_solutions(
    generated_set: IGCSEGeneratedSet, data: dict[str, Any]
) -> WorkedSolutionsAsset:
    defaults = {
        "pdf_url": str(data.get("pdf_url") or "").strip(),
        "sha256": str(data.get("sha256") or "").strip(),
        "page_count": data.get("page_count"),
    }
    asset, was_created = WorkedSolutionsAsset.objects.get_or_create(
        generated_set=generated_set,
        defaults=defaults,
    )
    if not was_created:
        for key, val in defaults.items():
            setattr(asset, key, val)
    if data.get("pdf_file") is not None:
        asset.pdf_file = data["pdf_file"]
    asset.save()
    return asset


def _upsert_simulator(
    generated_set: IGCSEGeneratedSet,
    data: dict[str, Any],
    *,
    source_dir: Path | None = None,
    storage_prefix: str,
) -> SimulatorSet:
    sim_id = str(data.get("simulator_set_id") or data.get("set_id") or "").strip()
    if not sim_id:
        raise IngestValidationError("simulator.simulator_set_id is required")

    artifact_json = data.get("artifact_json") if isinstance(data.get("artifact_json"), dict) else {}
    artifact_path = str(data.get("artifact_path") or data.get("path") or "").strip()
    artifact_file = data.get("artifact_file")

    if artifact_file is None and artifact_path:
        local = resolve_path_under_source_dir(source_dir, artifact_path)
        if local is None:
            raise IngestValidationError(f"simulator: artifact not found at {artifact_path!r}")
        artifact_file = save_local_file_to_storage(
            local_path=local,
            storage_path=f"{storage_prefix}/{local.name}",
        )

    defaults = {
        "simulator_set_id": sim_id,
        "public_url": str(data.get("public_url") or "").strip(),
        "artifact_url": str(data.get("artifact_url") or "").strip(),
        "artifact_json": artifact_json,
        "schema_version": str(data.get("schema_version") or "").strip(),
        "build_id": str(data.get("build_id") or "").strip(),
    }
    sim, was_created = SimulatorSet.objects.get_or_create(
        generated_set=generated_set,
        defaults=defaults,
    )
    if not was_created:
        for key, val in defaults.items():
            setattr(sim, key, val)
    if artifact_file is not None:
        sim.artifact_file = artifact_file
    sim.save()
    return sim
