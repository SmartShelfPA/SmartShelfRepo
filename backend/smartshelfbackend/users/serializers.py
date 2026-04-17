from django.utils.text import slugify
from rest_framework import serializers

from .models import Book, Category, Organization, ReadingProgress, UserProfile


class OrganizationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Organization
        fields = ("id", "name", "slug", "address", "created_at")


class UserProfileSerializer(serializers.ModelSerializer):
    organization = OrganizationSerializer(read_only=True)
    managed_student_ids = serializers.PrimaryKeyRelatedField(
        source="managed_students", many=True, read_only=True
    )

    class Meta:
        model = UserProfile
        fields = (
            "id",
            "username",
            "email",
            "role",
            "full_name",
            "date_of_birth",
            "avatar_url",
            "staff_role",
            "staff_department",
            "organization",
            "managed_student_ids",
        )


class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ("id", "name", "slug")


class BookSerializer(serializers.ModelSerializer):
    category = CategorySerializer(many=True, read_only=True)

    class Meta:
        model = Book
        fields = (
            "id",
            "isbn",
            "title",
            "author",
            "cover_image_url",
            "description",
            "page_count",
            "published_year",
            "category",
        )


class ReadingProgressSerializer(serializers.ModelSerializer):
    book = BookSerializer(read_only=True)
    percent_complete = serializers.FloatField(read_only=True)

    class Meta:
        model = ReadingProgress
        fields = (
            "id",
            "status",
            "current_page",
            "last_read_at",
            "rating",
            "percent_complete",
            "book",
        )


class BookshelfSerializer(serializers.Serializer):
    book = BookSerializer()
    progress = ReadingProgressSerializer()


class StaffBookCreateSerializer(serializers.ModelSerializer):
    category = serializers.ListField(
        child=serializers.CharField(max_length=120), required=False, allow_empty=True
    )

    class Meta:
        model = Book
        fields = (
            "isbn",
            "title",
            "author",
            "cover_image_url",
            "description",
            "page_count",
            "published_year",
            "category",
        )

    def create(self, validated_data):
        category_names = validated_data.pop("category", [])
        request = self.context["request"]
        book = Book.objects.create(organization=request.user.organization, **validated_data)

        categories = []
        for name in category_names:
            slug = slugify(name)
            category, _ = Category.objects.get_or_create(
                organization=request.user.organization,
                slug=slug,
                defaults={"name": name},
            )
            categories.append(category)

        if categories:
            book.category.set(categories)
        return book
