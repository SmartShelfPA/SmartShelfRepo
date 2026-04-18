from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin

from .models import (
    Book,
    Category,
    Organization,
    PublisherProfile,
    ReadingProgress,
    UserProfile,
)


@admin.register(Organization)
class OrganizationAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "slug", "created_at")
    search_fields = ("name", "slug")
    readonly_fields = ("id", "created_at")


@admin.register(UserProfile)
class UserProfileAdmin(DjangoUserAdmin):
    model = UserProfile
    list_display = ("id", "username", "email", "role", "organization", "is_staff")
    list_filter = ("role", "organization", "is_staff", "is_superuser", "is_active")
    search_fields = ("username", "email", "full_name")
    readonly_fields = ("id", "last_login", "date_joined")
    filter_horizontal = ("managed_students", "groups", "user_permissions")

    fieldsets = DjangoUserAdmin.fieldsets + (
        (
            "SmartShelf",
            {
                "fields": (
                    "organization",
                    "role",
                    "full_name",
                    "date_of_birth",
                    "avatar_url",
                    "staff_role",
                    "staff_department",
                    "managed_students",
                )
            },
        ),
    )


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "slug", "organization")
    list_filter = ("organization",)
    search_fields = ("name", "slug")


@admin.register(Book)
class BookAdmin(admin.ModelAdmin):
    list_display = ("id", "title", "author", "isbn", "publisher", "organization")
    list_filter = ("organization", "published_year")
    search_fields = ("title", "author", "isbn")
    filter_horizontal = ("category",)


@admin.register(PublisherProfile)
class PublisherProfileAdmin(admin.ModelAdmin):
    list_display = ("id", "company_name", "contact_email", "is_verified", "created_at")
    list_filter = ("is_verified",)
    search_fields = ("company_name", "contact_email", "user__username")


@admin.register(ReadingProgress)
class ReadingProgressAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "book", "status", "current_page", "rating", "last_read_at")
    list_filter = ("status", "organization")
    search_fields = ("user__username", "book__title", "book__isbn")
