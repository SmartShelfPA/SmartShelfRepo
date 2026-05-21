from __future__ import annotations

from django.db.models import QuerySet
from django.shortcuts import get_object_or_404

from igcse_catalog.models import IGCSEChapter, IGCSEGeneratedSet, IGCSESubject


def get_published_subjects() -> QuerySet[IGCSESubject]:
    return IGCSESubject.objects.filter(is_published=True).order_by("display_order", "title")


def get_chapters_for_subject(*, subject_slug: str) -> QuerySet[IGCSEChapter]:
    subject = get_object_or_404(IGCSESubject, slug=subject_slug.strip().lower(), is_published=True)
    return (
        IGCSEChapter.objects.filter(subject=subject, is_published=True)
        .select_related("subject")
        .order_by("display_order", "title")
    )


def queryset_published_sets(*, latest_only: bool = True) -> QuerySet[IGCSEGeneratedSet]:
    qs = (
        IGCSEGeneratedSet.objects.filter(is_published=True)
        .select_related("chapter", "chapter__subject")
        .select_related("practice_paper", "worked_solutions", "simulator")
    )
    if latest_only:
        qs = qs.filter(is_latest_published=True)
    return qs.order_by("-generated_at")


def _apply_set_filters(
    qs: QuerySet[IGCSEGeneratedSet],
    *,
    subject_slug: str | None,
    chapter_slug: str | None,
) -> QuerySet[IGCSEGeneratedSet]:
    if subject_slug:
        qs = qs.filter(chapter__subject__slug=subject_slug.strip().lower())
    if chapter_slug:
        qs = qs.filter(chapter__slug=chapter_slug.strip().lower())
    if subject_slug or chapter_slug:
        qs = qs.filter(chapter__subject__is_published=True, chapter__is_published=True)
    return qs


def get_published_sets(
    *,
    subject_slug: str | None = None,
    chapter_slug: str | None = None,
    latest_only: bool = True,
) -> QuerySet[IGCSEGeneratedSet]:
    qs = _apply_set_filters(
        queryset_published_sets(latest_only=latest_only),
        subject_slug=subject_slug,
        chapter_slug=chapter_slug,
    )

    if latest_only and not qs.exists():
        qs = _apply_set_filters(
            queryset_published_sets(latest_only=False),
            subject_slug=subject_slug,
            chapter_slug=chapter_slug,
        )
        # Chapter-scoped list: pick the newest published set for that chapter.
        if chapter_slug:
            newest = qs.order_by("-generated_at").first()
            if newest is not None:
                return IGCSEGeneratedSet.objects.filter(pk=newest.pk)
            return qs.none()
        # Subject-only or unfiltered: return all matching non-latest published sets.
        return qs

    return qs


def get_published_set_detail(*, set_id) -> IGCSEGeneratedSet:
    return get_object_or_404(
        queryset_published_sets(),
        pk=set_id,
    )
