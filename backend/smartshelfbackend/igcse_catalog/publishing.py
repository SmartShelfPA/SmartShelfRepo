"""Publish / unpublish helpers for admin and management commands."""

from __future__ import annotations

from django.db import transaction

from igcse_catalog.models import GenerationStatus, IGCSEChapter, IGCSEGeneratedSet, IGCSESubject
from igcse_catalog.services.ingestion import mark_latest_published


@transaction.atomic
def publish_generated_set(
    generated_set: IGCSEGeneratedSet,
    *,
    mark_latest: bool = True,
    cascade_parents: bool = True,
) -> IGCSEGeneratedSet:
    """Mark a set (and optionally its chapter/subject) as published."""
    chapter = generated_set.chapter
    subject = chapter.subject

    if cascade_parents:
        if not chapter.is_published:
            chapter.is_published = True
            chapter.save(update_fields=["is_published", "updated_at"])
        if not subject.is_published:
            subject.is_published = True
            subject.save(update_fields=["is_published", "updated_at"])

    generated_set.is_published = True
    generated_set.generation_status = GenerationStatus.PUBLISHED
    generated_set.save(update_fields=["is_published", "generation_status", "updated_at"])

    if mark_latest:
        mark_latest_published(generated_set)

    return generated_set


@transaction.atomic
def unpublish_generated_set(generated_set: IGCSEGeneratedSet, *, clear_latest: bool = True) -> None:
    generated_set.is_published = False
    if generated_set.generation_status == GenerationStatus.PUBLISHED:
        generated_set.generation_status = GenerationStatus.READY
    if clear_latest and generated_set.is_latest_published:
        generated_set.is_latest_published = False
    generated_set.save(
        update_fields=["is_published", "generation_status", "is_latest_published", "updated_at"]
    )


def publish_queryset(queryset, *, mark_latest: bool = True) -> int:
    count = 0
    for generated_set in queryset.select_related("chapter", "chapter__subject"):
        publish_generated_set(generated_set, mark_latest=mark_latest)
        count += 1
    return count


def unpublish_queryset(queryset) -> int:
    count = 0
    for generated_set in queryset:
        unpublish_generated_set(generated_set)
        count += 1
    return count


def mark_as_latest_only(generated_set: IGCSEGeneratedSet) -> None:
    """Set canonical latest flag without changing publish state."""
    mark_latest_published(generated_set)


@transaction.atomic
def publish_chapter(chapter: IGCSEChapter, *, publish_all_sets: bool = False) -> None:
    if not chapter.subject.is_published:
        chapter.subject.is_published = True
        chapter.subject.save(update_fields=["is_published", "updated_at"])
    chapter.is_published = True
    chapter.save(update_fields=["is_published", "updated_at"])

    if publish_all_sets:
        sets = IGCSEGeneratedSet.objects.filter(chapter=chapter, is_published=False)
        publish_queryset(sets, mark_latest=False)
        newest = (
            IGCSEGeneratedSet.objects.filter(chapter=chapter, is_published=True)
            .order_by("-generated_at")
            .first()
        )
        if newest:
            mark_latest_published(newest)


@transaction.atomic
def publish_subject(subject: IGCSESubject, *, publish_chapters: bool = False) -> None:
    subject.is_published = True
    subject.save(update_fields=["is_published", "updated_at"])
    if publish_chapters:
        for chapter in IGCSEChapter.objects.filter(subject=subject):
            publish_chapter(chapter, publish_all_sets=False)
