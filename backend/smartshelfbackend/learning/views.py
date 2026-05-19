from __future__ import annotations

import json

from django.conf import settings
from django.db.models import Avg, Count
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from learning.models import (
    ExamShelf,
    IgcsBookmark,
    IgcsEpubBook,
    IgcsHighlight,
    IgcsNote,
    IgcsUserReading,
    PracticeResponse,
    PracticeSession,
)
from learning.question_service import (
    default_subjects_for_exam,
    default_years,
    fetch_normalized_questions,
)
from learning.serializers import (
    IgcsBookmarkSerializer,
    IgcsEpubBookDetailSerializer,
    IgcsEpubBookSerializer,
    IgcsHighlightSerializer,
    IgcsNoteSerializer,
    IgcsReadingProgressSerializer,
    PracticeSessionCreateSerializer,
    PracticeSessionListSerializer,
    PracticeSessionSerializer,
)

def _require_org(user):
    org = getattr(user, "organization_id", None)
    if not org:
        return None
    return org


class IgcsBookListView(generics.ListAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = IgcsEpubBookSerializer

    def get_queryset(self):
        return IgcsEpubBook.objects.filter(is_active=True).order_by("title")

    def list(self, request, *args, **kwargs):
        books = list(self.get_queryset())
        readings = {
            str(r.book_id): r
            for r in IgcsUserReading.objects.filter(user=request.user, book__in=books)
        }
        serializer = self.get_serializer(
            books,
            many=True,
            context={**self.get_serializer_context(), "reading_map": readings},
        )
        return Response(serializer.data)


class IgcsBookDetailView(generics.RetrieveAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = IgcsEpubBookDetailSerializer
    lookup_field = "pk"

    def get_queryset(self):
        return IgcsEpubBook.objects.filter(is_active=True)

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        reading = (
            IgcsUserReading.objects.filter(user=request.user, book=instance).first()
        )
        readings = {str(instance.id): reading} if reading else {}
        serializer = self.get_serializer(
            instance, context={**self.get_serializer_context(), "reading_map": readings}
        )
        return Response(serializer.data)


class IgcsReadingProgressView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, pk):
        return self.put(request, pk)

    def put(self, request, pk):
        book = get_object_or_404(IgcsEpubBook, pk=pk, is_active=True)
        ser = IgcsReadingProgressSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        org = _require_org(request.user)
        if not org:
            return Response({"error": "User has no organization assigned."}, status=400)

        reading, _created = IgcsUserReading.objects.update_or_create(
            user=request.user,
            book=book,
            defaults={
                "fraction": ser.validated_data["fraction"],
                "start_cfi": ser.validated_data.get("start_cfi") or "",
            },
        )
        return Response(
            {
                "book_id": str(book.id),
                "fraction": reading.fraction,
                "start_cfi": reading.start_cfi,
                "updated_at": reading.last_read_at,
                "progress_percent": reading.progress_percent,
            }
        )


class IgcsBookmarkListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = IgcsBookmarkSerializer

    def get_queryset(self):
        book = get_object_or_404(IgcsEpubBook, pk=self.kwargs["book_pk"], is_active=True)
        return IgcsBookmark.objects.filter(user=self.request.user, book=book)

    def create(self, request, *args, **kwargs):
        org = _require_org(request.user)
        if not org:
            return Response({"error": "User has no organization assigned."}, status=400)
        book = get_object_or_404(IgcsEpubBook, pk=self.kwargs["book_pk"], is_active=True)
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(user=request.user, book=book, organization_id=org)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class IgcsBookmarkDetailView(generics.DestroyAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = IgcsBookmarkSerializer
    lookup_field = "pk"

    def get_queryset(self):
        book = get_object_or_404(IgcsEpubBook, pk=self.kwargs["book_pk"], is_active=True)
        return IgcsBookmark.objects.filter(user=self.request.user, book=book)


class IgcsHighlightListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = IgcsHighlightSerializer

    def get_queryset(self):
        book = get_object_or_404(IgcsEpubBook, pk=self.kwargs["book_pk"], is_active=True)
        return IgcsHighlight.objects.filter(user=self.request.user, book=book)

    def create(self, request, *args, **kwargs):
        org = _require_org(request.user)
        if not org:
            return Response({"error": "User has no organization assigned."}, status=400)
        book = get_object_or_404(IgcsEpubBook, pk=self.kwargs["book_pk"], is_active=True)
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(user=request.user, book=book, organization_id=org)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class IgcsHighlightDetailView(generics.DestroyAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = IgcsHighlightSerializer
    lookup_field = "pk"

    def get_queryset(self):
        book = get_object_or_404(IgcsEpubBook, pk=self.kwargs["book_pk"], is_active=True)
        return IgcsHighlight.objects.filter(user=self.request.user, book=book)


class IgcsNoteListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = IgcsNoteSerializer

    def get_queryset(self):
        book = get_object_or_404(IgcsEpubBook, pk=self.kwargs["book_pk"], is_active=True)
        return IgcsNote.objects.filter(user=self.request.user, book=book)

    def create(self, request, *args, **kwargs):
        org = _require_org(request.user)
        if not org:
            return Response({"error": "User has no organization assigned."}, status=400)
        book = get_object_or_404(IgcsEpubBook, pk=self.kwargs["book_pk"], is_active=True)
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(user=request.user, book=book, organization_id=org)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class IgcsNoteDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = IgcsNoteSerializer
    lookup_field = "pk"

    def get_queryset(self):
        book = get_object_or_404(IgcsEpubBook, pk=self.kwargs["book_pk"], is_active=True)
        return IgcsNote.objects.filter(user=self.request.user, book=book)


class PracticeSubjectsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, exam_kind: str):
        raw = getattr(settings, f"PRACTICE_SUBJECTS_{exam_kind.upper()}_JSON", "") or ""
        if raw.strip():
            try:
                data = json.loads(raw)
                if isinstance(data, list):
                    return Response(data)
            except json.JSONDecodeError:
                pass
        et = "JAMB" if exam_kind.lower() == "jamb" else "WAEC"
        return Response(default_subjects_for_exam(et))


class PracticeYearsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, exam_kind: str):
        raw = getattr(settings, "PRACTICE_YEARS_JSON", "") or ""
        if raw.strip():
            try:
                data = json.loads(raw)
                if isinstance(data, list):
                    return Response(data)
            except json.JSONDecodeError:
                pass
        return Response(default_years())


class PracticeQuestionsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, exam_kind: str):
        subject = request.query_params.get("subject") or ""
        year = int(request.query_params.get("year") or 0)
        exam_type = "JAMB" if exam_kind.lower() == "jamb" else "WAEC"
        if not subject:
            return Response({"error": "subject is required"}, status=400)
        questions = fetch_normalized_questions(
            exam_type=exam_type, subject=subject, year=year
        )
        return Response(questions)


class PracticeSessionListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        if self.request.method == "POST":
            return PracticeSessionCreateSerializer
        return PracticeSessionListSerializer

    def get_queryset(self):
        return PracticeSession.objects.filter(user=self.request.user).order_by("-started_at")[:50]

    def create(self, request, *args, **kwargs):
        org = _require_org(request.user)
        if not org:
            return Response({"error": "User has no organization assigned."}, status=400)
        ser = PracticeSessionCreateSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        session = PracticeSession.objects.create(
            user=request.user,
            organization_id=org,
            exam_type=ser.validated_data["exam_type"],
            subject=ser.validated_data["subject"],
            year=ser.validated_data.get("year"),
            status=PracticeSession.Status.IN_PROGRESS,
        )
        return Response(PracticeSessionListSerializer(session).data, status=status.HTTP_201_CREATED)


class PracticeSessionDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, pk):
        session = get_object_or_404(
            PracticeSession.objects.prefetch_related("responses"),
            pk=pk,
            user=request.user,
        )
        status_val = request.data.get("status")
        score = float(request.data.get("score_percent") or 0)
        duration = request.data.get("duration_seconds")
        responses = request.data.get("responses") or []

        if status_val:
            session.status = status_val
        session.score_percent = score
        if duration is not None:
            session.duration_seconds = int(duration)
        correct = int(request.data.get("correct_count") or 0)
        answered = int(request.data.get("answered_count") or 0)
        session.correct_count = correct
        session.answered_count = answered
        if status_val == PracticeSession.Status.COMPLETED:
            session.ended_at = timezone.now()
        session.save()

        PracticeResponse.objects.filter(session=session).delete()
        for item in responses:
            PracticeResponse.objects.create(
                session=session,
                question_id=str(item.get("question_id") or ""),
                selected_option_id=str(item.get("selected_option_id") or ""),
                correct_option_id=str(item.get("correct_option_id") or ""),
                is_correct=bool(item.get("is_correct")),
                order_index=int(item.get("order_index") or 0),
                time_spent_ms=item.get("time_spent_ms"),
            )

        session = PracticeSession.objects.prefetch_related("responses").get(pk=session.pk)
        return Response(PracticeSessionSerializer(session).data)


class DashboardView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user

        current_reading = (
            IgcsUserReading.objects.select_related("book")
            .filter(user=user)
            .order_by("-last_read_at")
            .first()
        )

        books_qs = IgcsUserReading.objects.select_related("book").filter(user=user)
        book_summaries = []
        for r in books_qs[:20]:
            ser = IgcsEpubBookSerializer(
                r.book,
                context={
                    "request": request,
                    "reading_map": {str(r.book_id): r},
                },
            )
            book_summaries.append(
                {
                    "book": ser.data,
                    "progress_percent": r.progress_percent,
                    "last_read_at": r.last_read_at,
                }
            )

        sessions = PracticeSession.objects.filter(user=user).order_by("-started_at")[:12]
        recent_sessions = PracticeSessionListSerializer(sessions, many=True).data

        avg_rows = []
        for et_value, _label in ExamShelf.choices:
            row = (
                PracticeSession.objects.filter(
                    user=user,
                    exam_type=et_value,
                    status=PracticeSession.Status.COMPLETED,
                ).aggregate(avg=Avg("score_percent"), n=Count("id"))
            )
            avg_rows.append(
                {
                    "exam_type": et_value,
                    "average_percent": float(row["avg"] or 0),
                    "session_count": row["n"],
                }
            )

        completed = PracticeSession.objects.filter(
            user=user, status=PracticeSession.Status.COMPLETED
        ).count()
        in_progress = PracticeSession.objects.filter(
            user=user, status=PracticeSession.Status.IN_PROGRESS
        ).count()

        last_read = current_reading.last_read_at if current_reading else None
        last_practice = sessions[0].started_at if len(sessions) > 0 else None
        last_activity = None
        candidates = [d for d in (last_read, last_practice) if d]
        if candidates:
            last_activity = max(candidates)

        current_book_payload = None
        if current_reading:
            ser = IgcsEpubBookSerializer(
                current_reading.book,
                context={
                    "request": request,
                    "reading_map": {str(current_reading.book_id): current_reading},
                },
            )
            current_book_payload = ser.data

        return Response(
            {
                "current_igcse_book": current_book_payload,
                "books": book_summaries,
                "recent_sessions": recent_sessions,
                "averages_by_exam": avg_rows,
                "completed_sessions": completed,
                "in_progress_sessions": in_progress,
                "last_activity_at": last_activity,
            }
        )
