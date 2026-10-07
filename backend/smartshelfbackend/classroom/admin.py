from django.contrib import admin

from .models import Assignment, AssignmentAnswer, AssignmentQuestion, AssignmentSubmission


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
