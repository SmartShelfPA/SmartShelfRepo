from __future__ import annotations

import json
from pathlib import Path

from django.contrib import admin, messages
from django.core.exceptions import ObjectDoesNotExist
from django.http import HttpResponseRedirect
from django.shortcuts import render
from django.urls import path, reverse
from django.utils.html import format_html

from igcse_catalog.admin_actions import (
    action_mark_as_latest,
    action_publish_chapters,
    action_publish_sets,
    action_publish_subjects,
    action_publish_without_latest,
    action_unpublish_chapters,
    action_unpublish_sets,
    action_unpublish_subjects,
)
from igcse_catalog.admin_forms import IGCSEGeneratedSetAdminForm, ManifestImportForm, parse_manifest_upload
from igcse_catalog.exceptions import IngestDuplicateError, IngestValidationError
from igcse_catalog.models import (
    IGCSEChapter,
    IGCSEGeneratedSet,
    IGCSESubject,
    PracticePaperAsset,
    SimulatorSet,
    WorkedSolutionsAsset,
)
from igcse_catalog.publishing import publish_generated_set, unpublish_generated_set
from igcse_catalog.services.ingestion import ingest_generated_set, mark_latest_published


class IGCSEChapterInline(admin.TabularInline):
    model = IGCSEChapter
    extra = 0
    fields = ("slug", "title", "display_order", "is_published")
    prepopulated_fields = {"slug": ("title",)}
    show_change_link = True


@admin.register(IGCSESubject)
class IGCSESubjectAdmin(admin.ModelAdmin):
    list_display = ("title", "slug", "display_order", "published_badge", "chapter_count", "updated_at")
    list_filter = ("is_published",)
    search_fields = ("title", "slug")
    prepopulated_fields = {"slug": ("title",)}
    readonly_fields = ("created_at", "updated_at")
    inlines = [IGCSEChapterInline]
    actions = [action_publish_subjects, action_unpublish_subjects]

    @admin.display(boolean=True, description="Published")
    def published_badge(self, obj: IGCSESubject) -> bool:
        return obj.is_published

    @admin.display(description="Chapters")
    def chapter_count(self, obj: IGCSESubject) -> int:
        return obj.chapters.count()


class IGCSEGeneratedSetInline(admin.TabularInline):
    model = IGCSEGeneratedSet
    extra = 0
    fields = (
        "version",
        "generation_status",
        "is_published",
        "is_latest_published",
        "generated_at",
        "pipeline_bundle_id",
    )
    readonly_fields = fields
    show_change_link = True
    can_delete = False
    ordering = ("-generated_at",)


@admin.register(IGCSEChapter)
class IGCSEChapterAdmin(admin.ModelAdmin):
    list_display = (
        "title",
        "subject",
        "slug",
        "display_order",
        "published_badge",
        "latest_set_link",
    )
    list_filter = ("is_published", "subject")
    search_fields = ("title", "slug", "subject__title", "subject__slug")
    prepopulated_fields = {"slug": ("title",)}
    autocomplete_fields = ("subject",)
    readonly_fields = ("created_at", "updated_at")
    inlines = [IGCSEGeneratedSetInline]
    actions = [action_publish_chapters, action_unpublish_chapters]

    @admin.display(boolean=True, description="Published")
    def published_badge(self, obj: IGCSEChapter) -> bool:
        return obj.is_published

    @admin.display(description="Latest set")
    def latest_set_link(self, obj: IGCSEChapter) -> str:
        latest = (
            obj.generated_sets.filter(is_latest_published=True)
            .order_by("-generated_at")
            .first()
        )
        if not latest:
            return "—"
        url = reverse("admin:igcse_catalog_igcsegeneratedset_change", args=[latest.pk])
        return format_html('<a href="{}">v{}</a>', url, latest.version)


class PracticePaperInline(admin.StackedInline):
    model = PracticePaperAsset
    extra = 0
    fields = ("pdf_file", "pdf_url", "sha256", "page_count")


class WorkedSolutionsInline(admin.StackedInline):
    model = WorkedSolutionsAsset
    extra = 0
    fields = ("pdf_file", "pdf_url", "sha256", "page_count")


class SimulatorInline(admin.StackedInline):
    model = SimulatorSet
    extra = 0
    fields = (
        "simulator_set_id",
        "public_url",
        "artifact_file",
        "artifact_url",
        "schema_version",
        "build_id",
    )


@admin.register(IGCSEGeneratedSet)
class IGCSEGeneratedSetAdmin(admin.ModelAdmin):
    form = IGCSEGeneratedSetAdminForm
    change_list_template = "admin/igcse_catalog/igcsegeneratedset/change_list.html"
    list_display = (
        "subject_chapter",
        "version",
        "generated_at",
        "generation_status",
        "published_badge",
        "latest_badge",
        "quality_score",
        "pipeline_bundle_id",
        "has_assets",
    )
    list_filter = (
        "generation_status",
        "is_published",
        "is_latest_published",
        "chapter__subject",
        "chapter",
    )
    search_fields = (
        "pipeline_bundle_id",
        "chapter__slug",
        "chapter__title",
        "chapter__subject__slug",
        "chapter__subject__title",
        "simulator__simulator_set_id",
    )
    list_select_related = ("chapter", "chapter__subject")
    autocomplete_fields = ("chapter",)
    date_hierarchy = "generated_at"
    readonly_fields = (
        "id",
        "created_at",
        "updated_at",
        "generation_metadata_pretty",
    )
    inlines = [PracticePaperInline, WorkedSolutionsInline, SimulatorInline]
    actions = [
        action_publish_sets,
        action_publish_without_latest,
        action_unpublish_sets,
        action_mark_as_latest,
    ]
    fieldsets = (
        (
            None,
            {
                "fields": (
                    "chapter",
                    "generated_at",
                    "version",
                )
            },
        ),
        (
            "Publishing",
            {
                "fields": (
                    "is_published",
                    "is_latest_published",
                    "generation_status",
                )
            },
        ),
        (
            "Pipeline",
            {
                "fields": (
                    "pipeline_bundle_id",
                    "quality_score",
                )
            },
        ),
        (
            "Generation metadata",
            {
                "fields": ("generation_metadata_pretty",),
                "classes": ("collapse",),
                "description": "Read-only snapshot from the study-agent pipeline.",
            },
        ),
        (
            "Audit",
            {
                "fields": ("id", "created_at", "updated_at"),
                "classes": ("collapse",),
            },
        ),
    )

    @admin.display(description="Subject / chapter")
    def subject_chapter(self, obj: IGCSEGeneratedSet) -> str:
        return f"{obj.chapter.subject.slug} / {obj.chapter.slug}"

    @admin.display(boolean=True, description="Published")
    def published_badge(self, obj: IGCSEGeneratedSet) -> bool:
        return obj.is_published

    @admin.display(boolean=True, description="Latest")
    def latest_badge(self, obj: IGCSEGeneratedSet) -> bool:
        return obj.is_latest_published

    @admin.display(description="Assets")
    def has_assets(self, obj: IGCSEGeneratedSet) -> str:
        parts = []
        for attr, label in (
            ("practice_paper", "paper"),
            ("worked_solutions", "solutions"),
            ("simulator", "sim"),
        ):
            try:
                getattr(obj, attr)
            except ObjectDoesNotExist:
                continue
            parts.append(label)
        return ", ".join(parts) if parts else "—"

    @admin.display(description="Generation metadata")
    def generation_metadata_pretty(self, obj: IGCSEGeneratedSet) -> str:
        if not obj.generation_metadata:
            return "—"
        text = json.dumps(obj.generation_metadata, indent=2, sort_keys=True, default=str)
        return format_html("<pre style='max-height:24em;overflow:auto'>{}</pre>", text)

    def get_queryset(self, request):
        qs = super().get_queryset(request)
        return qs.select_related(
            "chapter",
            "chapter__subject",
            "practice_paper",
            "worked_solutions",
            "simulator",
        )

    def save_model(self, request, obj, form, change):
        was_published = False
        was_latest = False
        if change and obj.pk:
            prior = (
                IGCSEGeneratedSet.objects.filter(pk=obj.pk)
                .values_list("is_published", "is_latest_published")
                .first()
            )
            if prior:
                was_published, was_latest = prior

        super().save_model(request, obj, form, change)

        if obj.is_published and not was_published:
            publish_generated_set(obj, mark_latest=obj.is_latest_published)
        elif not obj.is_published and was_published:
            unpublish_generated_set(obj)
        elif obj.is_published and obj.is_latest_published and not was_latest:
            mark_latest_published(obj)
        elif obj.is_latest_published and not obj.is_published:
            obj.is_latest_published = False
            obj.save(update_fields=["is_latest_published", "updated_at"])

    def get_urls(self):
        urls = super().get_urls()
        custom = [
            path(
                "import-manifest/",
                self.admin_site.admin_view(self.import_manifest_view),
                name="igcse_catalog_igcsegeneratedset_import_manifest",
            ),
        ]
        return custom + urls

    def changelist_view(self, request, extra_context=None):
        extra_context = extra_context or {}
        extra_context["import_manifest_url"] = reverse(
            "admin:igcse_catalog_igcsegeneratedset_import_manifest"
        )
        return super().changelist_view(request, extra_context=extra_context)

    def import_manifest_view(self, request):
        if request.method == "POST":
            form = ManifestImportForm(request.POST, request.FILES)
            if form.is_valid():
                try:
                    manifest = parse_manifest_upload(form.cleaned_data["manifest_file"])
                except Exception as exc:
                    form.add_error("manifest_file", str(exc))
                else:
                    source_folder = (form.cleaned_data.get("source_folder") or "").strip()
                    source_dir = Path(source_folder) if source_folder else None
                    if source_folder:
                        manifest.setdefault("source_folder", source_folder)
                    try:
                        result = ingest_generated_set(manifest, source_dir=source_dir)
                    except (IngestDuplicateError, IngestValidationError) as exc:
                        messages.error(request, str(exc))
                    else:
                        gs = result.generated_set
                        if form.cleaned_data.get("publish_after_ingest"):
                            publish_generated_set(gs, mark_latest=True)
                        action = "Created" if result.created else "Updated"
                        messages.success(
                            request,
                            f"{action} generated set {gs.id} (v{result.version}) for "
                            f"{gs.subject_slug}/{gs.chapter_slug}.",
                        )
                        return HttpResponseRedirect(
                            reverse("admin:igcse_catalog_igcsegeneratedset_change", args=[gs.pk])
                        )
        else:
            form = ManifestImportForm()

        context = {
            **self.admin_site.each_context(request),
            "form": form,
            "title": "Import study-agent manifest",
            "opts": self.model._meta,
            "has_view_permission": self.has_view_permission(request),
        }
        return render(request, "admin/igcse_catalog/import_manifest.html", context)


@admin.register(PracticePaperAsset)
class PracticePaperAssetAdmin(admin.ModelAdmin):
    list_display = ("generated_set", "pdf_file", "pdf_url", "sha256", "page_count")
    list_filter = ("generated_set__chapter__subject",)
    search_fields = (
        "generated_set__pipeline_bundle_id",
        "generated_set__chapter__slug",
    )
    autocomplete_fields = ("generated_set",)


@admin.register(WorkedSolutionsAsset)
class WorkedSolutionsAssetAdmin(admin.ModelAdmin):
    list_display = ("generated_set", "pdf_file", "pdf_url", "sha256", "page_count")
    list_filter = ("generated_set__chapter__subject",)
    search_fields = (
        "generated_set__pipeline_bundle_id",
        "generated_set__chapter__slug",
    )
    autocomplete_fields = ("generated_set",)


@admin.register(SimulatorSet)
class SimulatorSetAdmin(admin.ModelAdmin):
    list_display = (
        "simulator_set_id",
        "generated_set",
        "public_url",
        "schema_version",
        "build_id",
    )
    list_filter = ("generated_set__chapter__subject",)
    search_fields = ("simulator_set_id", "build_id", "generated_set__pipeline_bundle_id")
    autocomplete_fields = ("generated_set",)
