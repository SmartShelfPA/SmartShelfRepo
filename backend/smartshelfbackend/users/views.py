from django.db.models import Q
from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Book, ReadingProgress, UserProfile
from .permissions import IsStaffRole
from .serializers import (
    BookSerializer,
    ReadingProgressSerializer,
    StaffBookCreateSerializer,
    UserProfileSerializer,
)


class ProfileView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
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
        serializer = ReadingProgressSerializer(progress_qs, many=True)
        return Response(serializer.data)


class StaffBookCreateView(generics.CreateAPIView):
    permission_classes = [IsAuthenticated, IsStaffRole]
    serializer_class = StaffBookCreateSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        book = serializer.save()
        output = BookSerializer(book)
        return Response(output.data, status=status.HTTP_201_CREATED)
