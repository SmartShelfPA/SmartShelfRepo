"""
Catalog handlers for ``/api/igcse/*`` study-agent content (no upstream HTTP).
"""

from __future__ import annotations

import logging
import uuid
from pathlib import Path

from django.http import Http404, HttpRequest
from rest_framework.response import Response

from igcse_catalog.envelope import envelope_error, envelope_ok
from igcse_catalog import presentation
from igcse_catalog.serializers import (
    GeneratedSetIngestSerializer,
    SetsListQuerySerializer,
    SubjectSlugQuerySerializer,
)
from igcse_catalog.services.catalog import (
    get_chapters_for_subject,
    get_published_set_detail,
    get_published_sets,
    get_published_subjects,
)
from igcse_catalog.exceptions import IngestDuplicateError, IngestValidationError
from igcse_catalog.services.ingestion import ingest_generated_set

logger = logging.getLogger(__name__)


def catalog_subjects_response(_request: HttpRequest) -> Response:
    subjects = [presentation.subject_item(s) for s in get_published_subjects()]
    return envelope_ok({"provider": presentation.PROVIDER_ID, "subjects": subjects})


def catalog_chapters_response(request: HttpRequest) -> Response:
    qs = SubjectSlugQuerySerializer(data=getattr(request, "query_params", request.GET))
    if not qs.is_valid():
        return envelope_error(
            code="validation_error",
            message="subject query parameter is required.",
            validation=qs.errors,
        )
    subject = qs.validated_data["subject"]
    chapters = [presentation.chapter_item(c) for c in get_chapters_for_subject(subject_slug=subject)]
    return envelope_ok(
        {
            "provider": presentation.PROVIDER_ID,
            "subject": subject,
            "chapters": chapters,
        }
    )


def catalog_sets_list_response(request: HttpRequest) -> Response:
    qs = SetsListQuerySerializer(data=getattr(request, "query_params", request.GET))
    if not qs.is_valid():
        return envelope_error(
            code="validation_error",
            message="Invalid sets query.",
            validation=qs.errors,
        )
    subject = qs.validated_subject()
    chapter = qs.validated_chapter()
    rows = get_published_sets(subject_slug=subject, chapter_slug=chapter)
    sets_payload = [presentation.set_summary(request, row) for row in rows]
    data: dict = {
        "provider": presentation.PROVIDER_ID,
        "sets": sets_payload,
    }
    if subject:
        data["subject"] = subject
    if chapter:
        data["chapter"] = chapter
    return envelope_ok(data)


def catalog_set_detail_response(request: HttpRequest, *, set_id: str) -> Response:
    try:
        parsed_id = uuid.UUID(str(set_id))
    except (TypeError, ValueError):
        return envelope_error(
            code="validation_error",
            message="Invalid set id (expected UUID).",
        )
    try:
        generated_set = get_published_set_detail(set_id=parsed_id)
    except Http404:
        return envelope_error(
            code="not_found",
            message="Generated set not found or not published.",
            status_code=404,
        )
    return envelope_ok(
        {
            "provider": presentation.PROVIDER_ID,
            "set": presentation.set_detail(request, generated_set),
        }
    )


def catalog_ingest_response(request: HttpRequest) -> Response:
    ser = GeneratedSetIngestSerializer(data=request.data)
    if not ser.is_valid():
        return envelope_error(
            code="validation_error",
            message="Invalid ingest payload.",
            validation=ser.errors,
        )
    source_folder = str(ser.validated_data.get("source_folder") or "").strip()
    source_dir = Path(source_folder) if source_folder else None
    if source_dir is not None and not source_dir.is_dir():
        return envelope_error(
            code="validation_error",
            message=f"source_folder is not a directory: {source_folder}",
        )

    try:
        result = ingest_generated_set(ser.validated_data, source_dir=source_dir)
    except IngestDuplicateError as exc:
        return envelope_error(
            code="duplicate_set",
            message=str(exc),
            status_code=409,
            detail=exc.existing_set_id,
        )
    except IngestValidationError as exc:
        return envelope_error(code="validation_error", message=str(exc))
    except ValueError as exc:
        return envelope_error(code="validation_error", message=str(exc))
    except Exception as exc:  # noqa: BLE001
        logger.exception("IGCSE catalog ingest failed: %s", exc)
        return envelope_error(
            code="ingest_error",
            message="Could not ingest generated set.",
            status_code=500,
            detail=str(exc),
        )
    return envelope_ok(
        {
            "provider": presentation.PROVIDER_ID,
            "created": result.created,
            "version": result.version,
            "set": presentation.set_detail(request, result.generated_set),
        },
        status_code=201 if result.created else 200,
    )


__all__ = [
    "catalog_chapters_response",
    "catalog_ingest_response",
    "catalog_set_detail_response",
    "catalog_sets_list_response",
    "catalog_subjects_response",
]
