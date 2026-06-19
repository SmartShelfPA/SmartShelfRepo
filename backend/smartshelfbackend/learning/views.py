from __future__ import annotations

import json
import logging

import requests
from django.conf import settings
from django.db.models import Avg, Count
from django.http import FileResponse, StreamingHttpResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import generics, status
from rest_framework.permissions import AllowAny, IsAuthenticated
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
    ProtectedPdfAsset,
    ProtectedPdfAccessLog,
)
from learning.question_service import (
    default_subjects_for_exam,
    default_years,
    fetch_normalized_questions,
)
from learning.services.bundled_epubs import (
    resolve_bundled_file_path,
    get_bundled_book,
    list_bundled_books,
    resolve_bundled_epub_path,
)
from learning.services.explain import fetch_ai_answer_explanation
from learning.services.providers.aloc_errors import AlocProviderError
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
    ProtectedPdfAssetSerializer,
)
from learning.services.protected_pdf import (
    TokenError,
    client_ip,
    make_download_token,
    verify_download_token,
)

logger = logging.getLogger(__name__)


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


class IgcsBookEpubDownloadView(APIView):
    """
    Authenticated EPUB stream for the in-app WebView reader.
    Proxies remote URLs so epub.js is not blocked by ngrok interstitials or CORS.

    Supports auth via either:
      - Standard ``Authorization: Bearer <token>`` header, OR
      - Query parameter ``?token=<token>`` (for WebViews that can't send headers
        due to CORS preflight restrictions on cross-origin HTTP requests).
    """

    permission_classes = [AllowAny]

    def get(self, request, pk):
        from rest_framework.authtoken.models import Token as DRFToken

        user = request.user
        if not user or not user.is_authenticated:
            token_key = request.query_params.get("token", "").strip()
            if token_key:
                try:
                    token_obj = DRFToken.objects.select_related("user").get(key=token_key)
                    user = token_obj.user
                except DRFToken.DoesNotExist:
                    pass
            if not user or not user.is_authenticated:
                return Response({"error": "Authentication required."}, status=401)
        book = get_object_or_404(IgcsEpubBook, pk=pk, is_active=True)

        if book.epub_file:
            filename = f"{book.title or 'textbook'}.epub"
            resp = FileResponse(
                book.epub_file.open("rb"),
                content_type="application/epub+zip",
                as_attachment=False,
                filename=filename,
            )
            resp["Access-Control-Allow-Origin"] = "*"
            return resp

        remote_url = (book.epub_url or "").strip()
        if not remote_url:
            return Response({"error": "No EPUB file is linked for this title."}, status=404)

        headers = {"Accept": "application/epub+zip,application/octet-stream,*/*"}
        try:
            upstream = requests.get(
                remote_url,
                headers=headers,
                stream=True,
                timeout=float(getattr(settings, "ALOC_REQUEST_TIMEOUT", 30)),
            )
            upstream.raise_for_status()
        except Exception as exc:
            logger.warning("EPUB proxy failed for book %s: %s", pk, exc)
            return Response(
                {"error": "Could not fetch EPUB from the configured URL."},
                status=502,
            )

        def stream_chunks():
            try:
                for chunk in upstream.iter_content(chunk_size=65536):
                    if chunk:
                        yield chunk
            finally:
                upstream.close()

        response = StreamingHttpResponse(
            stream_chunks(),
            content_type=upstream.headers.get("Content-Type", "application/epub+zip"),
        )
        response["Cache-Control"] = "private, max-age=3600"
        return response


class IgcsBundledBookListView(APIView):
    """Textbooks shipped in ``bundled-igcse/`` (no Django admin upload)."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        books = []
        for item in list_bundled_books():
            books.append(
                {
                    "id": item.get("id"),
                    "title": item.get("title"),
                    "subject": item.get("subject"),
                    "author": item.get("author"),
                    "description": item.get("description"),
                    "source": "bundled",
                }
            )
        return Response(books)


class IgcsBundledEpubDownloadView(APIView):
    """Stream a repo-bundled EPUB for the in-app WebView reader (legacy route)."""

    permission_classes = [AllowAny]
    authentication_classes: list = []

    def get(self, request, book_id: str):
        meta = get_bundled_book(book_id)
        result = resolve_bundled_file_path(book_id)
        if not meta or not result:
            return Response({"error": "Bundled textbook not found."}, status=404)
        path, mime = result
        title = str(meta.get("title") or "textbook")
        ext = "pdf" if mime == "application/pdf" else "epub"
        resp = FileResponse(
            path.open("rb"),
            content_type=mime,
            as_attachment=False,
            filename=f"{title}.{ext}",
        )
        resp["Access-Control-Allow-Origin"] = "*"
        return resp


class IgcsBundledPdfDownloadView(APIView):
    """Stream a repo-bundled PDF so the in-app PDF viewer can load it.

    AllowAny + no auth class: PDFs are shipped in the repo; no login required.
    CORS header added so WebViews can fetch without preflights.
    """

    permission_classes = [AllowAny]
    authentication_classes: list = []

    def get(self, request, book_id: str):
        meta = get_bundled_book(book_id)
        result = resolve_bundled_file_path(book_id)
        if not meta or not result:
            return Response({"error": "Bundled textbook not found."}, status=404)
        path, mime = result
        if mime != "application/pdf":
            return Response({"error": "This book is not a PDF."}, status=400)
        title = str(meta.get("title") or "textbook")
        resp = FileResponse(
            path.open("rb"),
            content_type="application/pdf",
            as_attachment=False,
            filename=f"{title}.pdf",
        )
        resp["Access-Control-Allow-Origin"] = "*"
        resp["Content-Disposition"] = f'inline; filename="{title}.pdf"'
        return resp


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
        try:
            questions = fetch_normalized_questions(
                exam_type=exam_type, subject=subject, year=year
            )
        except AlocProviderError as exc:
            return Response({"error": str(exc)}, status=503)
        return Response(questions)


class PracticeExplainView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        exam_type = str(request.data.get("exam_type") or "WAEC").upper()
        subject = str(request.data.get("subject") or "").strip()
        year = int(request.data.get("year") or 0)
        question = request.data.get("question")
        if not subject:
            return Response({"error": "subject is required"}, status=400)
        if not isinstance(question, dict):
            return Response({"error": "question object is required"}, status=400)
        try:
            text = fetch_ai_answer_explanation(
                exam_type=exam_type,
                subject=subject,
                year=year,
                question=question,
            )
        except ValueError as exc:
            return Response({"error": str(exc)}, status=503)
        except Exception as exc:
            logger.warning("Practice explain failed: %s", exc)
            return Response({"error": "Could not generate explanation."}, status=502)
        return Response({"explanation": text})


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


# ── Protected PDF assets ───────────────────────────────────────────────────


def _accessible_protected_pdfs(user):
    """Published + approved assets the user is allowed to see (metadata level)."""
    qs = ProtectedPdfAsset.objects.filter(
        published=True,
        rights_status=ProtectedPdfAsset.RightsStatus.APPROVED,
    )
    # Hide staff-only assets from non-staff users.
    is_staff = bool(
        getattr(user, "is_staff", False)
        or getattr(user, "role", "") in ("staff", "publisher")
    )
    if not is_staff:
        qs = qs.exclude(access_level=ProtectedPdfAsset.AccessLevel.STAFF)
    return qs


class ProtectedPdfListView(generics.ListAPIView):
    """GET /api/v1/igcse/pdfs/ — metadata for downloadable protected PDFs."""

    permission_classes = [IsAuthenticated]
    serializer_class = ProtectedPdfAssetSerializer

    def get_queryset(self):
        return _accessible_protected_pdfs(self.request.user)


class ProtectedPdfDetailView(generics.RetrieveAPIView):
    """GET /api/v1/igcse/pdfs/<id>/ — single asset metadata (no file URL)."""

    permission_classes = [IsAuthenticated]
    serializer_class = ProtectedPdfAssetSerializer

    def get_queryset(self):
        return _accessible_protected_pdfs(self.request.user)


class ProtectedPdfAuthorizeDownloadView(APIView):
    """
    POST /api/v1/igcse/pdfs/<id>/authorize-download/

    Re-checks rights + access on every call and returns a short-lived signed
    download token. Failing this check is the revocation point for future
    downloads and offline opens.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        asset = get_object_or_404(ProtectedPdfAsset, pk=pk)
        user = request.user

        if not asset.user_can_access(user):
            ProtectedPdfAccessLog.objects.create(
                asset=asset,
                user=user if getattr(user, "pk", None) else None,
                event=ProtectedPdfAccessLog.Event.DENIED,
                ip_address=client_ip(request),
                notes="authorize-download denied",
            )
            return Response(
                {"error": "You do not have access to this resource.", "code": "access_denied"},
                status=status.HTTP_403_FORBIDDEN,
            )

        token = make_download_token(asset_id=asset.id, user_id=user.pk)
        max_age = getattr(settings, "PROTECTED_DOWNLOAD_TOKEN_MAX_AGE", 300)
        offline_days = getattr(settings, "PROTECTED_OFFLINE_ACCESS_DAYS", 30)
        now = timezone.now()

        ProtectedPdfAccessLog.objects.create(
            asset=asset,
            user=user,
            event=ProtectedPdfAccessLog.Event.AUTHORIZED,
            ip_address=client_ip(request),
        )

        download_path = f"/api/v1/igcse/pdfs/{asset.id}/download/?token={token}"
        return Response(
            {
                "asset_id": str(asset.id),
                "title": asset.title,
                "download_url": request.build_absolute_uri(download_path),
                "token": token,
                "expires_in": max_age,
                "expires_at": (now + timezone.timedelta(seconds=max_age)).isoformat(),
                "offline_access_expires_at": (
                    now + timezone.timedelta(days=offline_days)
                ).isoformat(),
                "rights_version": asset.rights_version,
                "file_size_bytes": asset.file_size_bytes,
            }
        )


class ProtectedPdfDownloadView(APIView):
    """
    GET /api/v1/igcse/pdfs/<id>/download/?token=<signed>

    Validates the signed token (the signature IS the authorization, so this
    route does not depend on the Bearer session) and streams the file.
    """

    permission_classes = [AllowAny]
    authentication_classes: list = []

    def get(self, request, pk):
        asset = get_object_or_404(ProtectedPdfAsset, pk=pk)
        token = (request.GET.get("token") or "").strip()
        if not token:
            return Response({"error": "Missing download token."}, status=400)

        # Token embeds the user id it was minted for; verify against it.
        try:
            data = signing_unpack(token)
        except TokenError as exc:
            return Response({"error": str(exc), "code": "token_invalid"}, status=403)

        try:
            verify_download_token(token, asset_id=asset.id, user_id=data["user_id"])
        except TokenError as exc:
            return Response({"error": str(exc), "code": "token_invalid"}, status=403)

        # Defense-in-depth: even with a valid token, refuse if rights changed.
        if not asset.is_downloadable:
            return Response(
                {"error": "This resource is no longer available.", "code": "revoked"},
                status=410,
            )

        if not asset.pdf_file:
            return Response({"error": "File missing."}, status=404)

        from django.contrib.auth import get_user_model

        user_obj = get_user_model().objects.filter(pk=data.get("user_id")).first()
        ProtectedPdfAccessLog.objects.create(
            asset=asset,
            user=user_obj,
            event=ProtectedPdfAccessLog.Event.DOWNLOADED,
            ip_address=client_ip(request),
        )

        resp = FileResponse(
            asset.pdf_file.open("rb"),
            content_type="application/pdf",
            as_attachment=False,
            filename=f"{asset.title}.pdf",
        )
        resp["Content-Disposition"] = f'inline; filename="{asset.title}.pdf"'
        resp["Cache-Control"] = "no-store"
        return resp


def signing_unpack(token: str) -> dict:
    """Peek at token contents (without max_age) to learn the bound user id.

    Expiry + tamper checks still happen in ``verify_download_token``.
    """
    from django.core import signing as _signing

    try:
        data = _signing.loads(token, salt="learning.protected_pdf.download")
    except _signing.BadSignature as exc:
        raise TokenError("Invalid download link.") from exc
    if not isinstance(data, dict) or "user_id" not in data:
        raise TokenError("Malformed download token.")
    return data
