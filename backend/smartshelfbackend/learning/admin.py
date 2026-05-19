from django.contrib import admin

from learning.models import (
    CachedNormalizedQuestion,
    IgcsBookmark,
    IgcsEpubBook,
    IgcsHighlight,
    IgcsNote,
    IgcsUserReading,
    PracticeResponse,
    PracticeSession,
    QuestionCacheBatch,
)


@admin.register(IgcsEpubBook)
class IgcsEpubBookAdmin(admin.ModelAdmin):
    list_display = ("title", "subject", "is_active", "organization", "updated_at")
    list_filter = ("is_active", "subject")
    search_fields = ("title", "subject", "author")


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
