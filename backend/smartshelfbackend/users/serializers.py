from django.utils.text import slugify
from rest_framework import serializers

from .models import (
    Book,
    Category,
    Organization,
    PublisherProfile,
    ReadingProgress,
    UserProfile,
)


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
            "student_class",
            "avatar_url",
            "staff_role",
            "staff_department",
            "organization",
            "managed_student_ids",
        )


class PublisherProfileSerializer(serializers.ModelSerializer):
    companyName = serializers.CharField(source="company_name")
    contactEmail = serializers.EmailField(source="contact_email")
    isVerified = serializers.BooleanField(source="is_verified")
    catalogSize = serializers.IntegerField(source="catalog_size", read_only=True)

    class Meta:
        model = PublisherProfile
        fields = ("id", "companyName", "contactEmail", "isVerified", "catalogSize")


class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ("id", "name", "slug")


class BookSerializer(serializers.ModelSerializer):
    publisherId = serializers.UUIDField(source="publisher_id", read_only=True)
    coverImageUrl = serializers.SerializerMethodField()
    pageCount = serializers.IntegerField(source="page_count")
    category = serializers.SerializerMethodField()

    class Meta:
        model = Book
        fields = (
            "id",
            "publisherId",
            "isbn",
            "title",
            "author",
            "coverImageUrl",
            "description",
            "pageCount",
            "category",
        )

    def get_coverImageUrl(self, obj):
        request = self.context.get("request")
        if obj.cover_image_url:
            return obj.cover_image_url
        if obj.cover_image_file and request:
            return request.build_absolute_uri(obj.cover_image_file.url)
        return ""

    def get_category(self, obj):
        return [item.name for item in obj.category.all()]


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


class ReadingProgressInlineSerializer(serializers.ModelSerializer):
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
        )


class BookshelfSerializer(serializers.Serializer):
    book = BookSerializer()
    progress = ReadingProgressInlineSerializer()


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


class PublisherBookUploadSerializer(serializers.ModelSerializer):
    pageCount = serializers.IntegerField(source="page_count")
    coverImage = serializers.FileField(required=False, allow_null=True, write_only=True)
    contentFile = serializers.FileField(required=False, allow_null=True, write_only=True)
    category = serializers.ListField(
        child=serializers.CharField(max_length=120), required=False, allow_empty=True
    )

    class Meta:
        model = Book
        fields = (
            "id",
            "isbn",
            "title",
            "author",
            "pageCount",
            "category",
            "description",
            "coverImage",
            "contentFile",
        )
        read_only_fields = ("id",)

    def create(self, validated_data):
        request = self.context["request"]
        category_names = validated_data.pop("category", [])
        cover_file = validated_data.pop("coverImage", None)
        content_file = validated_data.pop("contentFile", None)
        book = Book.objects.create(
            organization=request.user.organization,
            publisher=request.user,
            **validated_data,
        )

        if cover_file:
            book.cover_image_file = cover_file
        if content_file:
            book.content_file = content_file
        book.save()

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

    def update(self, instance, validated_data):
        category_names = validated_data.pop("category", None)
        cover_file = validated_data.pop("coverImage", None)
        content_file = validated_data.pop("contentFile", None)

        for attr, value in validated_data.items():
            setattr(instance, attr, value)

        request = self.context.get("request")
        if cover_file:
            instance.cover_image_file = cover_file
        if content_file:
            instance.content_file = content_file
        instance.save()

        if category_names is not None:
            categories = []
            for name in category_names:
                slug = slugify(name)
                category, _ = Category.objects.get_or_create(
                    organization=instance.organization,
                    slug=slug,
                    defaults={"name": name},
                )
                categories.append(category)
            instance.category.set(categories)
        return instance
