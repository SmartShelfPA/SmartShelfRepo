import uuid

from django.contrib.auth.models import AbstractUser
from django.core.exceptions import ValidationError
from django.db import models

from .tenant import OrganizationScopedManager


class Organization(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255)
    slug = models.SlugField(unique=True)
    address = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["name"]

    def __str__(self) -> str:
        return self.name


class UserProfile(AbstractUser):
    class Role(models.TextChoices):
        STUDENT = "student", "Student"
        PARENT = "parent", "Parent"
        STAFF = "staff", "School Staff"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name="users",
        null=True,
        blank=True,
    )
    role = models.CharField(max_length=20, choices=Role.choices)
    full_name = models.CharField(max_length=255)
    date_of_birth = models.DateField(null=True, blank=True)
    avatar_url = models.URLField(blank=True)

    # Staff-specific fields
    staff_role = models.CharField(max_length=120, blank=True)
    staff_department = models.CharField(max_length=120, blank=True)

    # Parent-specific relation
    managed_students = models.ManyToManyField(
        "self",
        related_name="managed_by_parents",
        symmetrical=False,
        blank=True,
    )

    objects = OrganizationScopedManager()

    def clean(self) -> None:
        super().clean()
        if self.role == self.Role.STAFF:
            return
        if self.staff_role or self.staff_department:
            raise ValidationError(
                "staff_role and staff_department can only be set for staff users."
            )

    def __str__(self) -> str:
        return self.username


class Category(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        Organization, on_delete=models.CASCADE, related_name="categories"
    )
    name = models.CharField(max_length=120)
    slug = models.SlugField()

    class Meta:
        unique_together = ("organization", "slug")
        ordering = ["name"]

    def __str__(self) -> str:
        return self.name


class Book(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        Organization, on_delete=models.CASCADE, related_name="books"
    )
    isbn = models.CharField(max_length=20)
    title = models.CharField(max_length=255)
    author = models.CharField(max_length=255)
    cover_image_url = models.URLField(blank=True)
    description = models.TextField(blank=True)
    page_count = models.PositiveIntegerField()
    published_year = models.PositiveIntegerField(null=True, blank=True)
    category = models.ManyToManyField(Category, related_name="books", blank=True)

    objects = OrganizationScopedManager()

    class Meta:
        unique_together = ("organization", "isbn")
        ordering = ["title"]

    def __str__(self) -> str:
        return f"{self.title} ({self.isbn})"


class ReadingProgress(models.Model):
    class Status(models.TextChoices):
        TO_READ = "to-read", "To Read"
        READING = "reading", "Reading"
        COMPLETED = "completed", "Completed"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        Organization, on_delete=models.CASCADE, related_name="reading_progress"
    )
    user = models.ForeignKey(
        UserProfile, on_delete=models.CASCADE, related_name="reading_progress"
    )
    book = models.ForeignKey(Book, on_delete=models.CASCADE, related_name="reading_progress")
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.TO_READ)
    current_page = models.PositiveIntegerField(default=0)
    last_read_at = models.DateTimeField(auto_now=True)
    rating = models.PositiveSmallIntegerField(null=True, blank=True)

    objects = OrganizationScopedManager()

    class Meta:
        unique_together = ("user", "book")
        ordering = ["-last_read_at"]

    @property
    def percent_complete(self) -> float:
        if self.book.page_count <= 0:
            return 0.0
        return round((self.current_page / self.book.page_count) * 100, 2)

    def clean(self) -> None:
        super().clean()
        if self.user.organization_id != self.book.organization_id:
            raise ValidationError("User and book must belong to the same organization.")

    def save(self, *args, **kwargs):
        if self.user_id and self.book_id:
            self.organization_id = self.user.organization_id
        super().save(*args, **kwargs)
