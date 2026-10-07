import uuid

from django.conf import settings
from django.db import models

from users.models import Organization


class Feedback(models.Model):
    """In-app feedback from students, parents and teachers, triaged in Django admin."""

    class Category(models.TextChoices):
        BUG = "bug", "Something isn't working"
        IDEA = "idea", "Feature idea"
        CONTENT = "content", "Content / textbook issue"
        QUESTION = "question", "Question / need help"
        PRAISE = "praise", "Something I like"
        OTHER = "other", "Other"

    class Status(models.TextChoices):
        NEW = "new", "New"
        TRIAGED = "triaged", "Reviewed"
        PLANNED = "planned", "Planned"
        IN_PROGRESS = "in_progress", "In progress"
        DONE = "done", "Done"
        WONT_DO = "wont_do", "Won't do"

    class Priority(models.TextChoices):
        UNSET = "", "Not set"
        LOW = "low", "Low"
        MEDIUM = "medium", "Medium"
        HIGH = "high", "High"
        CRITICAL = "critical", "Critical"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="feedback",
    )
    organization = models.ForeignKey(
        Organization, on_delete=models.SET_NULL, null=True, blank=True, related_name="feedback"
    )
    role = models.CharField(max_length=20, blank=True)
    category = models.CharField(max_length=16, choices=Category.choices, default=Category.OTHER)
    message = models.TextField()
    rating = models.PositiveSmallIntegerField(null=True, blank=True, help_text="1-5 overall rating.")
    screen = models.CharField(max_length=200, blank=True, help_text="Screen the user was on.")
    app_version = models.CharField(max_length=40, blank=True)
    platform = models.CharField(max_length=40, blank=True)
    contact_ok = models.BooleanField(default=True, help_text="User is happy to be contacted.")

    status = models.CharField(max_length=16, choices=Status.choices, default=Status.NEW)
    priority = models.CharField(max_length=10, choices=Priority.choices, blank=True, default="")
    admin_notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name_plural = "Feedback"

    def __str__(self) -> str:
        who = self.user.username if self.user else "anonymous"
        return f"{self.get_category_display()} from {who}"
