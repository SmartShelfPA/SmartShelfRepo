from django.contrib import admin

from .models import (
    Assignment,
    AssignmentAnswer,
    AssignmentQuestion,
    AssignmentSubmission,
    Message,
    MessageThread,
    PdfReadingState,
    RevisionCard,
    TextbookLicence,
    TextbookTopic,
)


class AssignmentQuestionInline(admin.StackedInline):
    model = AssignmentQuestion
    extra = 0


@admin.register(Assignment)
class AssignmentAdmin(admin.ModelAdmin):
    list_display = ("title", "kind", "organization", "target_class", "created_by", "due_at", "created_at")
    list_filter = ("kind", "organization")
    search_fields = ("title", "subject", "target_class")
    inlines = [AssignmentQuestionInline]


class AssignmentAnswerInline(admin.TabularInline):
    model = AssignmentAnswer
    extra = 0


@admin.register(AssignmentSubmission)
class AssignmentSubmissionAdmin(admin.ModelAdmin):
    list_display = ("assignment", "student", "status", "score_percent", "submitted_at", "graded_at")
    list_filter = ("status", "assignment__organization")
    search_fields = ("assignment__title", "student__username", "student__full_name")
    inlines = [AssignmentAnswerInline]


class MessageInline(admin.TabularInline):
    model = Message
    extra = 0
    readonly_fields = ("sender", "body", "created_at")
    can_delete = False


@admin.register(MessageThread)
class MessageThreadAdmin(admin.ModelAdmin):
    """Read-only record of parent–teacher conversations for safeguarding review."""

    list_display = ("parent", "teacher", "student", "organization", "last_message_at")
    list_filter = ("organization",)
    search_fields = ("parent__username", "teacher__username", "student__username", "student__full_name")
    readonly_fields = (
        "organization", "parent", "teacher", "student", "last_message_at",
        "parent_last_read_at", "teacher_last_read_at", "created_at",
    )
    inlines = [MessageInline]

    def has_add_permission(self, request):
        return False


@admin.register(TextbookLicence)
class TextbookLicenceAdmin(admin.ModelAdmin):
    list_display = ("asset", "organization", "target_class", "term_label", "starts_on", "ends_on")
    list_filter = ("organization",)


@admin.register(TextbookTopic)
class TextbookTopicAdmin(admin.ModelAdmin):
    list_display = ("title", "asset", "chapter_label", "organization")


@admin.register(RevisionCard)
class RevisionCardAdmin(admin.ModelAdmin):
    list_display = ("user", "asset", "page", "next_review_at")


@admin.register(PdfReadingState)
class PdfReadingStateAdmin(admin.ModelAdmin):
    list_display = ("user", "asset", "page", "updated_at")
