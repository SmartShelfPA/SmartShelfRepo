from __future__ import annotations

from django.http import HttpRequest

from igcse_catalog.models import IGCSEChapter, IGCSEGeneratedSet, IGCSESubject
from igcse_catalog.services.assets import resolve_asset_url

PROVIDER_ID = "study_agent"


def subject_item(subject: IGCSESubject) -> dict:
    return {"id": subject.slug, "title": subject.title}


def chapter_item(chapter: IGCSEChapter) -> dict:
    return {"id": chapter.slug, "title": chapter.title}


def _paper_urls(request: HttpRequest | None, generated_set: IGCSEGeneratedSet) -> tuple[str, str]:
    practice_url = ""
    solutions_url = ""
    try:
        paper = generated_set.practice_paper
        practice_url = resolve_asset_url(
            request, file_field=paper.pdf_file, url_field=paper.pdf_url
        )
    except Exception:  # noqa: BLE001
        pass
    try:
        sol = generated_set.worked_solutions
        solutions_url = resolve_asset_url(
            request, file_field=sol.pdf_file, url_field=sol.pdf_url
        )
    except Exception:  # noqa: BLE001
        pass
    return practice_url, solutions_url


def _simulator_fields(request: HttpRequest | None, generated_set: IGCSEGeneratedSet) -> dict:
    try:
        sim = generated_set.simulator
    except Exception:  # noqa: BLE001
        return {
            "simulator_set_id": "",
            "simulator_public_url": "",
            "simulator_artifact_url": "",
        }
    artifact_url = resolve_asset_url(
        request, file_field=sim.artifact_file, url_field=sim.artifact_url
    )
    return {
        "simulator_set_id": sim.simulator_set_id,
        "simulator_public_url": sim.public_url or "",
        "simulator_artifact_url": artifact_url,
        "simulator_schema_version": sim.schema_version or "",
        "simulator_build_id": sim.build_id or "",
    }


def set_summary(request: HttpRequest | None, generated_set: IGCSEGeneratedSet) -> dict:
    practice_url, solutions_url = _paper_urls(request, generated_set)
    sim_fields = _simulator_fields(request, generated_set)
    return {
        "id": str(generated_set.id),
        "subject_slug": generated_set.subject_slug,
        "chapter_slug": generated_set.chapter_slug,
        "chapter_title": generated_set.chapter_title,
        "practice_paper_url": practice_url,
        "worked_solutions_url": solutions_url,
        "generated_at": generated_set.generated_at.isoformat(),
        "is_published": generated_set.is_published,
        "generation_status": generated_set.generation_status,
        "quality_score": generated_set.quality_score,
        "pipeline_bundle_id": generated_set.pipeline_bundle_id or None,
        "version": generated_set.version,
        "is_latest_published": generated_set.is_latest_published,
        **sim_fields,
    }


def set_detail(request: HttpRequest | None, generated_set: IGCSEGeneratedSet) -> dict:
    summary = set_summary(request, generated_set)
    practice = getattr(generated_set, "practice_paper", None)
    solutions = getattr(generated_set, "worked_solutions", None)
    simulator = getattr(generated_set, "simulator", None)

    summary["generation_metadata"] = generated_set.generation_metadata or {}
    summary["practice_paper"] = None
    summary["worked_solutions"] = None
    summary["simulator"] = None

    if practice is not None:
        summary["practice_paper"] = {
            "url": resolve_asset_url(
                request, file_field=practice.pdf_file, url_field=practice.pdf_url
            ),
            "sha256": practice.sha256 or None,
            "page_count": practice.page_count,
        }
    if solutions is not None:
        summary["worked_solutions"] = {
            "url": resolve_asset_url(
                request, file_field=solutions.pdf_file, url_field=solutions.pdf_url
            ),
            "sha256": solutions.sha256 or None,
            "page_count": solutions.page_count,
        }
    if simulator is not None:
        summary["simulator"] = {
            "simulator_set_id": simulator.simulator_set_id,
            "public_url": simulator.public_url or "",
            "artifact_url": resolve_asset_url(
                request,
                file_field=simulator.artifact_file,
                url_field=simulator.artifact_url,
            ),
            "artifact_json": simulator.artifact_json or {},
            "schema_version": simulator.schema_version or "",
            "build_id": simulator.build_id or "",
        }
    return summary
