from django.db.models import Q
from rest_framework import generics, status
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Book, PublisherProfile, ReadingProgress, UserProfile
from .permissions import IsPublisherRole, IsStaffRole
from .serializers import (
    BookSerializer,
    BookshelfSerializer,
    PublisherBookUploadSerializer,
    PublisherProfileSerializer,
    ReadingProgressInlineSerializer,
    StaffBookCreateSerializer,
    UserProfileSerializer,
)


class ProfileView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if request.user.role == UserProfile.Role.PUBLISHER:
            publisher_profile = (
                PublisherProfile.objects.filter(user=request.user).first()
            )
            if not publisher_profile:
                return Response(
                    {"error": "Publisher profile is missing for this user."}, status=404
                )
            serializer = PublisherProfileSerializer(publisher_profile)
            return Response(serializer.data)
        serializer = UserProfileSerializer(request.user)
        return Response(serializer.data)


class BookListView(generics.ListAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = BookSerializer

    def get_queryset(self):
        queryset = Book.objects.prefetch_related("category").order_by("title")
        search = self.request.query_params.get("search")
        category = self.request.query_params.get("category")

        if search:
            queryset = queryset.filter(
                Q(title__icontains=search)
                | Q(author__icontains=search)
                | Q(isbn__icontains=search)
            )

        if category:
            queryset = queryset.filter(
                Q(category__slug__iexact=category)
                | Q(category__name__iexact=category)
                | Q(category__id=category)
            )

        return queryset.distinct()


class BookshelfView(APIView):
    permission_classes = [IsAuthenticated]

    def get_progress_queryset(self, user):
        queryset = ReadingProgress.objects.select_related("book", "user").prefetch_related(
            "book__category"
        )
        if user.role == UserProfile.Role.STUDENT:
            return queryset.filter(user=user)
        if user.role == UserProfile.Role.PARENT:
            return queryset.filter(user__in=user.managed_students.all())
        return queryset

    def get(self, request):
        progress_qs = self.get_progress_queryset(request.user)
        data = [
            {
                "book": BookSerializer(item.book, context={"request": request}).data,
                "progress": ReadingProgressInlineSerializer(item).data,
            }
            for item in progress_qs
        ]
        serializer = BookshelfSerializer(data, many=True)
        return Response(serializer.data)


class StaffBookCreateView(generics.CreateAPIView):
    permission_classes = [IsAuthenticated, IsStaffRole]
    serializer_class = StaffBookCreateSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        book = serializer.save()
        output = BookSerializer(book, context={"request": request})
        return Response(output.data, status=status.HTTP_201_CREATED)


class PublisherBookCreateView(generics.CreateAPIView):
    permission_classes = [IsAuthenticated, IsPublisherRole]
    serializer_class = PublisherBookUploadSerializer
    parser_classes = [MultiPartParser, FormParser]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        book = serializer.save()
        return Response(
            BookSerializer(book, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )


class PublisherBookUpdateView(generics.UpdateAPIView):
    permission_classes = [IsAuthenticated, IsPublisherRole]
    serializer_class = PublisherBookUploadSerializer
    parser_classes = [MultiPartParser, FormParser]
    queryset = Book.objects.all()
    lookup_field = "id"

    def get_queryset(self):
        return Book.objects.filter(publisher=self.request.user)

    def patch(self, request, *args, **kwargs):
        return self.partial_update(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        book = serializer.save()
        return Response(BookSerializer(book, context={"request": request}).data)


class PublisherCatalogView(generics.ListAPIView):
    permission_classes = [IsAuthenticated, IsPublisherRole]
    serializer_class = BookSerializer

    def get_queryset(self):
        return (
            Book.objects.filter(publisher=self.request.user)
            .prefetch_related("category")
            .order_by("-id")
        )
