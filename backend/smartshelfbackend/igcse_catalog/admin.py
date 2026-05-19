from django.contrib import admin

from igcse_catalog.models import (
    IGCSEChapter,
    IGCSEGeneratedSet,
    IGCSESubject,
    PracticePaperAsset,
    SimulatorSet,
    WorkedSolutionsAsset,
)


class IGCSEChapterInline(admin.TabularInline):
    model = IGCSEChapter
    extra = 0
    fields = ("slug", "title", "display_order", "is_published")
    prepopulated_fields = {"slug": ("title",)}


@admin.register(IGCSESubject)
class IGCSESubjectAdmin(admin.ModelAdmin):
    list_display = ("title", "slug", "display_order", "is_published", "updated_at")
    list_filter = ("is_published",)
    search_fields = ("title", "slug")
    prepopulated_fields = {"slug": ("title",)}
    inlines = [IGCSEChapterInline]


@admin.register(IGCSEChapter)
class IGCSEChapterAdmin(admin.ModelAdmin):
    list_display = ("title", "subject", "slug", "display_order", "is_published")
    list_filter = ("is_published", "subject")
    search_fields = ("title", "slug", "subject__title")
    prepopulated_fields = {"slug": ("title",)}


class PracticePaperInline(admin.StackedInline):
    model = PracticePaperAsset
    extra = 0


class WorkedSolutionsInline(admin.StackedInline):
    model = WorkedSolutionsAsset
    extra = 0


class SimulatorInline(admin.StackedInline):
    model = SimulatorSet
    extra = 0


@admin.register(IGCSEGeneratedSet)
class IGCSEGeneratedSetAdmin(admin.ModelAdmin):
    list_display = (
        "chapter",
        "version",
        "generated_at",
        "generation_status",
        "is_published",
        "is_latest_published",
        "quality_score",
        "pipeline_bundle_id",
    )
    list_filter = ("generation_status", "is_published", "is_latest_published", "chapter__subject")
    search_fields = ("pipeline_bundle_id", "chapter__slug", "chapter__subject__slug")
    readonly_fields = ("id", "created_at", "updated_at")
    inlines = [PracticePaperInline, WorkedSolutionsInline, SimulatorInline]


@admin.register(PracticePaperAsset)
class PracticePaperAssetAdmin(admin.ModelAdmin):
    list_display = ("generated_set", "pdf_url", "sha256", "page_count")


@admin.register(WorkedSolutionsAsset)
class WorkedSolutionsAssetAdmin(admin.ModelAdmin):
    list_display = ("generated_set", "pdf_url", "sha256", "page_count")


@admin.register(SimulatorSet)
class SimulatorSetAdmin(admin.ModelAdmin):
    list_display = ("simulator_set_id", "generated_set", "public_url", "schema_version", "build_id")
    search_fields = ("simulator_set_id", "build_id")
