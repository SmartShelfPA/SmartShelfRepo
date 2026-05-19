from __future__ import annotations

from django.contrib import messages

from igcse_catalog.models import IGCSESubject
from igcse_catalog.publishing import (
    mark_as_latest_only,
    publish_generated_set,
    publish_queryset,
    unpublish_queryset,
)


def action_publish_sets(modeladmin, request, queryset):
    count = publish_queryset(queryset, mark_latest=True)
    modeladmin.message_user(
        request,
        f"Published {count} generated set(s) and marked each as the latest for its chapter.",
        messages.SUCCESS,
    )


action_publish_sets.short_description = "Publish selected sets (and mark as latest)"


def action_unpublish_sets(modeladmin, request, queryset):
    count = unpublish_queryset(queryset)
    modeladmin.message_user(request, f"Unpublished {count} generated set(s).", messages.SUCCESS)


action_unpublish_sets.short_description = "Unpublish selected sets"


def action_mark_as_latest(modeladmin, request, queryset):
    if queryset.count() != 1:
        modeladmin.message_user(
            request,
            "Select exactly one generated set to mark as latest for its chapter.",
            messages.ERROR,
        )
        return
    generated_set = queryset.select_related("chapter").first()
    if not generated_set.is_published:
        publish_generated_set(generated_set, mark_latest=True)
        modeladmin.message_user(
            request,
            "Set was unpublished; published it and marked as latest.",
            messages.SUCCESS,
        )
        return
    mark_as_latest_only(generated_set)
    modeladmin.message_user(
        request,
        f"Marked {generated_set} as the latest published set for its chapter.",
        messages.SUCCESS,
    )


action_mark_as_latest.short_description = "Mark as latest published (single selection)"


def action_publish_without_latest(modeladmin, request, queryset):
    count = publish_queryset(queryset, mark_latest=False)
    modeladmin.message_user(
        request,
        f"Published {count} set(s) without changing the latest flag.",
        messages.SUCCESS,
    )


action_publish_without_latest.short_description = "Publish selected (do not change latest)"


def action_unpublish_subjects(modeladmin, request, queryset):
    updated = queryset.update(is_published=False)
    modeladmin.message_user(request, f"Unpublished {updated} subject(s).", messages.SUCCESS)


action_unpublish_subjects.short_description = "Unpublish selected subjects"


def action_publish_subjects(modeladmin, request, queryset):
    updated = queryset.update(is_published=True)
    modeladmin.message_user(request, f"Published {updated} subject(s).", messages.SUCCESS)


action_publish_subjects.short_description = "Publish selected subjects"


def action_publish_chapters(modeladmin, request, queryset):
    updated = queryset.update(is_published=True)
    subject_ids = queryset.values_list("subject_id", flat=True).distinct()
    IGCSESubject.objects.filter(id__in=subject_ids, is_published=False).update(is_published=True)
    modeladmin.message_user(
        request,
        f"Published {updated} chapter(s) and ensured parent subjects are published.",
        messages.SUCCESS,
    )


action_publish_chapters.short_description = "Publish selected chapters (+ parent subjects)"


def action_unpublish_chapters(modeladmin, request, queryset):
    updated = queryset.update(is_published=False)
    modeladmin.message_user(request, f"Unpublished {updated} chapter(s).", messages.SUCCESS)


action_unpublish_chapters.short_description = "Unpublish selected chapters"
