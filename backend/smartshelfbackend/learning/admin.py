from django import forms
from django.contrib import admin, messages
from django.core.files.base import ContentFile
from django.db import transaction

from learning.models import (
    CachedNormalizedQuestion,
    IgcsBookmark,
    IgcsEpubBook,
    IgcsHighlight,
    IgcsNote,
    IgcsUserReading,
    PracticeResponse,
    PracticeSession,
    ProtectedPdfAccessLog,
    ProtectedPdfAsset,
    QuestionCacheBatch,
)
from learning.services.epub_import import EpubImportError, fetch_epub_bytes
from users.models import AuditLog


class IgcsEpubBookAdminForm(forms.ModelForm):
    class Meta:
        model = IgcsEpubBook
        fields = "__all__"

    def clean(self):
        cleaned = super().clean()
        import_url = (cleaned.get("import_source_url") or "").strip()
        epub_url = (cleaned.get("epub_url") or "").strip()
        epub_file = cleaned.get("epub_file")

        if import_url and not epub_file and not self.instance.epub_file:
            pass
        elif not import_url and not epub_url and not epub_file and not self.instance.epub_file:
            raise forms.ValidationError(
                "Provide at least one of: Import source URL, EPUB URL, or EPUB file upload."
            )
        return cleaned


@admin.register(IgcsEpubBook)
class IgcsEpubBookAdmin(admin.ModelAdmin):
    form = IgcsEpubBookAdminForm
    list_display = (
        "title", "subject", "rights_status", "license_type", "is_active", "organization", "updated_at",
    )
    list_filter = ("is_active", "subject", "rights_status", "license_type")
    search_fields = ("title", "subject", "author", "content_source")
    readonly_fields = ("created_at", "updated_at")
    fieldsets = (
        (
            None,
            {
                "fields": (
                    "title",
                    "subject",
                    "author",
                    "description",
                    "cover_image_url",
                    "organization",
                    "is_active",
                )
            },
        ),
        (
            "EPUB source (pick one or more)",
            {
                "description": (
                    "<strong>Import source URL</strong> uses the vendored "
                    "<a href='https://github.com/mcombeau/epub_downloader' target='_blank' "
                    "rel='noopener'>epub_downloader</a> on save — supports "
                    "<code>epub.pub</code>, <code>readanybook.com</code>, and remote EPUB "
                    "archive URLs. For Gutenberg or other direct <code>.epub</code> links, "
                    "use <strong>EPUB URL</strong> or upload the file instead."
                ),
                "fields": (
                    "import_source_url",
                    "epub_url",
                    "epub_file",
                ),
            },
        ),
        (
            "Rights & Licensing",
            {
                "description": "Set these before making a book visible. 'Unknown' blocks nothing technically but flags the record for review.",
                "fields": ("license_type", "rights_status", "content_source", "rights_notes"),
            },
        ),
        (
            "Advanced",
            {"fields": ("toc_json", "extra_metadata", "created_at", "updated_at"), "classes": ("collapse",)},
        ),
    )

    @transaction.atomic
    def save_model(self, request, obj, form, change):
        # Audit: detect publish/unpublish transitions.
        if change and "is_active" in form.changed_data:
            action = (
                AuditLog.Action.CONTENT_PUBLISH if obj.is_active
                else AuditLog.Action.CONTENT_UNPUBLISH
            )
            AuditLog.log(
                action,
                actor=request.user,
                target=obj,
                notes=f"Admin {'published' if obj.is_active else 'unpublished'} EPUB: {obj.title}",
            )

        import_url = (obj.import_source_url or "").strip()
        if import_url:
            try:
                epub_bytes, filename = fetch_epub_bytes(import_url)
            except EpubImportError as exc:
                self.message_user(
                    request,
                    f"EPUB import failed: {exc}",
                    level=messages.ERROR,
                )
                raise

            if obj.epub_file:
                obj.epub_file.delete(save=False)
            obj.epub_file.save(filename, ContentFile(epub_bytes), save=False)
            obj.import_source_url = ""
            self.message_user(
                request,
                f"Imported EPUB ({filename}) from {import_url}. "
                "The file is stored under EPUB file; students load it from your server.",
                level=messages.SUCCESS,
            )

        super().save_model(request, obj, form, change)


@admin.register(IgcsUserReading)
class IgcsUserReadingAdmin(admin.ModelAdmin):
    list_display = ("user", "book", "fraction", "last_read_at")
    search_fields = ("user__username", "book__title")


@admin.register(IgcsBookmark)
class IgcsBookmarkAdmin(admin.ModelAdmin):
    list_display = ("user", "book", "label", "created_at")


@admin.register(IgcsHighlight)
class IgcsHighlightAdmin(admin.ModelAdmin):
    list_display = ("user", "book", "color", "created_at")


@admin.register(IgcsNote)
class IgcsNoteAdmin(admin.ModelAdmin):
    list_display = ("user", "book", "created_at", "updated_at")


@admin.register(PracticeSession)
class PracticeSessionAdmin(admin.ModelAdmin):
    list_display = ("user", "exam_type", "subject", "year", "status", "score_percent", "started_at")
    list_filter = ("exam_type", "status")


@admin.register(PracticeResponse)
class PracticeResponseAdmin(admin.ModelAdmin):
    list_display = ("session", "question_id", "is_correct", "order_index")


@admin.register(CachedNormalizedQuestion)
class CachedNormalizedQuestionAdmin(admin.ModelAdmin):
    list_display = ("provider", "exam_type", "subject", "year", "expires_at")


@admin.register(QuestionCacheBatch)
class QuestionCacheBatchAdmin(admin.ModelAdmin):
    list_display = ("provider", "exam_type", "subject", "year", "expires_at")


class ProtectedPdfAccessLogInline(admin.TabularInline):
    model = ProtectedPdfAccessLog
    extra = 0
    can_delete = False
    readonly_fields = ("event", "user", "ip_address", "notes", "created_at")
    fields = ("event", "user", "ip_address", "notes", "created_at")
    ordering = ("-created_at",)

    def has_add_permission(self, request, obj=None):
        return False


@admin.register(ProtectedPdfAsset)
class ProtectedPdfAssetAdmin(admin.ModelAdmin):
    list_display = (
        "title", "subject", "published", "rights_status", "access_level",
        "rights_version", "file_size_bytes", "updated_at",
    )
    list_filter = ("published", "rights_status", "access_level", "subject")
    search_fields = ("title", "subject", "chapter", "description")
    readonly_fields = ("file_size_bytes", "created_at", "updated_at")
    actions = ("publish_assets", "unpublish_assets", "bump_rights_version")
    inlines = (ProtectedPdfAccessLogInline,)
    fieldsets = (
        (None, {"fields": ("title", "subject", "chapter", "description", "cover_image_url")}),
        ("File", {"fields": ("pdf_file", "file_size_bytes")}),
        ("Access & rights", {
            "fields": ("published", "rights_status", "access_level", "rights_version", "organization"),
        }),
        ("Timestamps", {"fields": ("created_at", "updated_at")}),
    )

    @admin.action(description="Publish selected PDFs")
    def publish_assets(self, request, queryset):
        updated = queryset.update(published=True)
        for asset in queryset:
            AuditLog.log(
                AuditLog.Action.CONTENT_PUBLISH,
                actor=request.user,
                target=asset,
                notes=f"Protected PDF published: {asset.title}",
            )
        self.message_user(request, f"{updated} PDF(s) published.", messages.SUCCESS)

    @admin.action(description="Unpublish selected PDFs (revokes new downloads)")
    def unpublish_assets(self, request, queryset):
        updated = queryset.update(published=False)
        for asset in queryset:
            AuditLog.log(
                AuditLog.Action.CONTENT_UNPUBLISH,
                actor=request.user,
                target=asset,
                notes=f"Protected PDF unpublished: {asset.title}",
            )
        self.message_user(request, f"{updated} PDF(s) unpublished.", messages.SUCCESS)

    @admin.action(description="Bump rights version (invalidate offline copies)")
    def bump_rights_version(self, request, queryset):
        for asset in queryset:
            asset.rights_version = (asset.rights_version or 1) + 1
            asset.save(update_fields=["rights_version", "updated_at"])
        self.message_user(
            request,
            f"Rights version bumped for {queryset.count()} PDF(s). Cached copies will re-authorize.",
            messages.SUCCESS,
        )


@admin.register(ProtectedPdfAccessLog)
class ProtectedPdfAccessLogAdmin(admin.ModelAdmin):
    list_display = ("asset", "event", "user", "ip_address", "created_at")
    list_filter = ("event", "created_at")
    search_fields = ("asset__title", "user__username", "ip_address")
    readonly_fields = ("asset", "user", "event", "ip_address", "notes", "created_at")

    def has_add_permission(self, request):
        return False
