import csv

from django.contrib import admin
from django.http import HttpResponse

from .models import Feedback


@admin.action(description="Export selected feedback to CSV")
def export_csv(modeladmin, request, queryset):
    response = HttpResponse(content_type="text/csv")
    response["Content-Disposition"] = 'attachment; filename="smartshelf_feedback.csv"'
    writer = csv.writer(response)
    writer.writerow(
        ["created_at", "school", "role", "user", "category", "rating", "screen", "platform",
         "app_version", "status", "priority", "message", "admin_notes"]
    )
    for fb in queryset.select_related("user", "organization"):
        writer.writerow(
            [
                fb.created_at.isoformat(),
                fb.organization.name if fb.organization else "",
                fb.role,
                fb.user.username if fb.user else "",
                fb.get_category_display(),
                fb.rating or "",
                fb.screen,
                fb.platform,
                fb.app_version,
                fb.get_status_display(),
                fb.get_priority_display(),
                fb.message,
                fb.admin_notes,
            ]
        )
    return response


@admin.register(Feedback)
class FeedbackAdmin(admin.ModelAdmin):
    list_display = (
        "created_at", "organization", "role", "user", "category", "rating", "short_message",
        "status", "priority",
    )
    list_editable = ("status", "priority")
    list_filter = ("status", "priority", "category", "role", "organization", "platform")
    search_fields = ("message", "user__username", "user__full_name", "admin_notes")
    readonly_fields = (
        "user", "organization", "role", "category", "message", "rating", "screen",
        "app_version", "platform", "contact_ok", "created_at", "updated_at",
    )
    actions = [export_csv]

    @admin.display(description="Message")
    def short_message(self, obj):
        return obj.message[:80] + ("…" if len(obj.message) > 80 else "")
