from django.db.models import Q
from django.utils import timezone
from rest_framework import generics, status
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import AuditLog, Book, DataRequest, PublisherProfile, ReadingProgress, UserProfile
from .permissions import IsPublisherRole, IsStaffRole
from .serializers import (
    BookSerializer,
    BookshelfSerializer,
    DataRequestSerializer,
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


class DataRequestView(APIView):
    """
    POST  /api/v1/privacy/data-request/   — submit a data rights request
    GET   /api/v1/privacy/data-request/   — list the authenticated user's requests
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        qs = DataRequest.objects.filter(user=request.user)
        return Response(DataRequestSerializer(qs, many=True).data)

    def post(self, request):
        serializer = DataRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        req = serializer.save(user=request.user)
        AuditLog.log(
            AuditLog.Action.ACCOUNT_DELETE_REQUEST
            if req.request_type == DataRequest.RequestType.DELETE
            else AuditLog.Action.DATA_EXPORT
            if req.request_type == DataRequest.RequestType.EXPORT
            else AuditLog.Action.ADMIN_ACTION,
            actor=request.user,
            target=request.user,
            notes=f"Data request submitted: {req.get_request_type_display()}",
        )
        return Response(DataRequestSerializer(req).data, status=status.HTTP_201_CREATED)


class ConsentUpdateView(APIView):
    """
    PATCH /api/v1/privacy/consent/  — update optional analytics/marketing consent.
    Required consent (terms + privacy) cannot be withdrawn here; submit a
    DELETE data request instead.
    """

    permission_classes = [IsAuthenticated]

    def patch(self, request):
        user = request.user
        analytics = request.data.get("analytics_consent")
        if analytics is None:
            return Response(
                {"error": "Provide analytics_consent (true/false)."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not isinstance(analytics, bool):
            return Response(
                {"error": "analytics_consent must be a boolean."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        prev = user.analytics_consent
        user.analytics_consent = analytics
        user.analytics_consent_at = timezone.now()
        user.save(update_fields=["analytics_consent", "analytics_consent_at"])
        AuditLog.log(
            AuditLog.Action.CONSENT_CHANGE,
            actor=user,
            target=user,
            notes=f"analytics_consent changed from {prev} to {analytics}.",
        )
        return Response(
            {
                "analytics_consent": user.analytics_consent,
                "analytics_consent_at": user.analytics_consent_at,
            }
        )
