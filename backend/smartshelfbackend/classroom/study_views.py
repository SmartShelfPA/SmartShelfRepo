"""School shelf, term licences, chapter quizzes, study plan, and revision cards."""

from __future__ import annotations

import csv
import io

from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import serializers, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from auth.views import CURRENT_PRIVACY_VERSION, CURRENT_TERMS_VERSION
from learning.models import ProtectedPdfAsset
from users.models import AuditLog, UserProfile
from users.permissions import IsSchoolAdmin, IsStaffRole

from .access import licence_allows
from .accounts import set_temp_password, unique_username
from .models import (
    AssignmentSubmission,
    PdfReadingState,
    RevisionCard,
    TextbookLicence,
    TextbookTopic,
    TopicAnswer,
    TopicAttempt,
    TopicQuestion,
)
from .progress import MASTERY_PERCENT, latest_attempts, topic_status, weekly_summary

MAX_IMPORT_ROWS = 200
REVIEW_INTERVALS_DAYS = (1, 3, 7)


def _asset_for_school(user, pk):
    return get_object_or_404(
        ProtectedPdfAsset,
        pk=pk,
        organization_id=user.organization_id,
        published=True,
        rights_status=ProtectedPdfAsset.RightsStatus.APPROVED,
    )


def _student_can_use(user, asset) -> bool:
    return asset.user_can_access(user) and licence_allows(user, asset)


def _catalogue(asset: ProtectedPdfAsset) -> dict:
    return {
        "id": str(asset.id),
        "title": asset.title,
        "subject": asset.subject,
        "author": asset.author,
        "edition": asset.edition,
        "isbn": asset.isbn,
        "publisher_name": asset.publisher_name,
        "curriculum": asset.curriculum,
        "file_size_bytes": asset.file_size_bytes,
        "offline_allowed": asset.offline_allowed,
    }


def _question_public(q: TopicQuestion) -> dict:
    return {
        "id": str(q.id),
        "order": q.order,
        "prompt": q.prompt,
        "options": q.options,
    }


def _question_revealed(q: TopicQuestion, selected: str, correct: bool) -> dict:
    data = _question_public(q)
    data.update(
        {
            "selected_option_id": selected,
            "correct_option_id": q.correct_option_id,
            "is_correct": correct,
            "explanation": q.explanation,
            "review_label": q.review_label,
            "review_page": q.review_page,
        }
    )
    return data


class LicenceWriteSerializer(serializers.Serializer):
    asset_id = serializers.UUIDField()
    target_class = serializers.CharField(required=False, allow_blank=True, max_length=120)
    term_label = serializers.CharField(max_length=80)
    starts_on = serializers.DateField()
    ends_on = serializers.DateField()

    def validate(self, attrs):
        if attrs["ends_on"] < attrs["starts_on"]:
            raise serializers.ValidationError("The term end date must be on or after the start date.")
        return attrs


class TopicWriteSerializer(serializers.Serializer):
    asset_id = serializers.UUIDField()
    title = serializers.CharField(max_length=200)
    chapter_label = serializers.CharField(required=False, allow_blank=True, max_length=120)
    page_start = serializers.IntegerField(required=False, allow_null=True, min_value=1)
    page_end = serializers.IntegerField(required=False, allow_null=True, min_value=1)
    questions = serializers.ListField(child=serializers.DictField(), min_length=1, max_length=20)

    def validate_questions(self, questions):
        cleaned = []
        for raw in questions:
            prompt = str(raw.get("prompt") or "").strip()
            options = []
            for idx, opt in enumerate(raw.get("options") or []):
                label = str(opt.get("label") or "").strip()
                if not label:
                    continue
                options.append({"id": str(opt.get("id") or chr(ord("A") + idx))[:16], "label": label[:1000]})
            correct = str(raw.get("correct_option_id") or "").strip()
            if not prompt or len(options) < 2 or correct not in {o["id"] for o in options}:
                raise serializers.ValidationError(
                    "Each question needs text, at least two options, and a correct option."
                )
            page = raw.get("review_page")
            cleaned.append(
                {
                    "prompt": prompt,
                    "options": options,
                    "correct_option_id": correct,
                    "explanation": str(raw.get("explanation") or "").strip(),
                    "review_label": str(raw.get("review_label") or "").strip()[:200],
                    "review_page": int(page) if page else None,
                }
            )
        return cleaned


class SchoolLicenceListCreateView(APIView):
    permission_classes = [IsAuthenticated, IsSchoolAdmin]

    def get(self, request):
        rows = TextbookLicence.objects.filter(
            organization_id=request.user.organization_id
        ).select_related("asset")
        return Response(
            [
                {
                    "id": str(row.id),
                    "asset_id": str(row.asset_id),
                    "title": row.asset.title,
                    "target_class": row.target_class,
                    "term_label": row.term_label,
                    "starts_on": row.starts_on.isoformat(),
                    "ends_on": row.ends_on.isoformat(),
                }
                for row in rows
            ]
        )

    def post(self, request):
        ser = LicenceWriteSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        data = ser.validated_data
        asset = get_object_or_404(
            ProtectedPdfAsset,
            pk=data["asset_id"],
            organization_id=request.user.organization_id,
        )
        row = TextbookLicence.objects.create(
            organization_id=request.user.organization_id,
            asset=asset,
            target_class=(data.get("target_class") or "").strip(),
            term_label=data["term_label"].strip(),
            starts_on=data["starts_on"],
            ends_on=data["ends_on"],
        )
        return Response({"id": str(row.id)}, status=status.HTTP_201_CREATED)


class SchoolLicenceDetailView(APIView):
    permission_classes = [IsAuthenticated, IsSchoolAdmin]

    def delete(self, request, pk):
        row = get_object_or_404(
            TextbookLicence, pk=pk, organization_id=request.user.organization_id
        )
        row.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class SchoolMemberImportView(APIView):
    """POST /api/v1/school/members/import/ with CSV text: full_name,email,class."""

    permission_classes = [IsAuthenticated, IsSchoolAdmin]

    @transaction.atomic
    def post(self, request):
        text = str(request.data.get("csv") or request.data.get("text") or "").strip()
        if not text:
            return Response({"error": "Paste a CSV with full name, email, and class."}, status=400)
        reader = csv.reader(io.StringIO(text))
        created = []
        errors = []
        org = request.user.organization
        for index, row in enumerate(reader, start=1):
            if index > MAX_IMPORT_ROWS:
                errors.append({"row": index, "error": f"Stopped after {MAX_IMPORT_ROWS} rows."})
                break
            cells = [c.strip() for c in row]
            if not any(cells):
                continue
            if cells[0].lower() in ("full_name", "name", "full name"):
                continue
            if len(cells) < 3 or not cells[0] or not cells[1] or not cells[2]:
                errors.append({"row": index, "error": "Need full name, email, and class."})
                continue
            full_name, email, student_class = cells[0], cells[1], cells[2]
            username = cells[3] if len(cells) > 3 else ""
            if UserProfile.objects.filter(email__iexact=email).exists():
                errors.append({"row": index, "error": f"{email} already has an account."})
                continue
            user = UserProfile.objects.create_user(
                username=unique_username(full_name, username),
                email=email,
                password=None,
                role=UserProfile.Role.STUDENT,
                full_name=full_name[:255],
                organization=org,
                student_class=student_class[:120],
                school_managed=bool(org.governs_student_data),
            )
            user.record_policy_acceptance(
                terms_version=CURRENT_TERMS_VERSION,
                privacy_version=CURRENT_PRIVACY_VERSION,
                save=True,
            )
            password = set_temp_password(user)
            created.append(
                {
                    "row": index,
                    "full_name": user.full_name,
                    "username": user.username,
                    "email": user.email,
                    "student_class": user.student_class,
                    "temporary_password": password,
                }
            )
        if created:
            AuditLog.log(
                AuditLog.Action.ADMIN_ACTION,
                actor=request.user,
                target=request.user,
                notes=f"Imported {len(created)} student accounts.",
            )
        return Response({"created": created, "errors": errors})


class SchoolTopicListCreateView(APIView):
    permission_classes = [IsAuthenticated, IsStaffRole]

    def get(self, request):
        qs = TextbookTopic.objects.filter(organization_id=request.user.organization_id).select_related(
            "asset"
        )
        asset_id = request.query_params.get("asset")
        if asset_id:
            qs = qs.filter(asset_id=asset_id)
        return Response(
            [
                {
                    "id": str(topic.id),
                    "title": topic.title,
                    "chapter_label": topic.chapter_label,
                    "page_start": topic.page_start,
                    "page_end": topic.page_end,
                    "asset_id": str(topic.asset_id),
                    "asset_title": topic.asset.title,
                    "question_count": topic.questions.count(),
                }
                for topic in qs
            ]
        )

    @transaction.atomic
    def post(self, request):
        ser = TopicWriteSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        data = ser.validated_data
        asset = _asset_for_school(request.user, data["asset_id"])
        topic = TextbookTopic.objects.create(
            organization_id=request.user.organization_id,
            asset=asset,
            title=data["title"].strip(),
            chapter_label=(data.get("chapter_label") or "").strip(),
            page_start=data.get("page_start"),
            page_end=data.get("page_end"),
            created_by=request.user,
        )
        TopicQuestion.objects.bulk_create(
            [
                TopicQuestion(topic=topic, order=idx, **q)
                for idx, q in enumerate(data["questions"])
            ]
        )
        return Response({"id": str(topic.id)}, status=status.HTTP_201_CREATED)


class SchoolTopicDetailView(APIView):
    permission_classes = [IsAuthenticated, IsStaffRole]

    def delete(self, request, pk):
        topic = get_object_or_404(
            TextbookTopic, pk=pk, organization_id=request.user.organization_id
        )
        topic.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class StudentTopicListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        if user.role != UserProfile.Role.STUDENT or not user.organization_id:
            return Response([])
        attempts = latest_attempts(user)
        topics = (
            TextbookTopic.objects.filter(organization_id=user.organization_id)
            .select_related("asset")
            .prefetch_related("questions")
        )
        rows = []
        for topic in topics:
            if not _student_can_use(user, topic.asset):
                continue
            attempt = attempts.get(topic.id)
            score = attempt.score_percent if attempt else None
            rows.append(
                {
                    **{
                        "id": str(topic.id),
                        "title": topic.title,
                        "chapter_label": topic.chapter_label,
                        "page_start": topic.page_start,
                        "page_end": topic.page_end,
                        "question_count": len(topic.questions.all()),
                    },
                    "asset": _catalogue(topic.asset),
                    "status": topic_status(score),
                    "score_percent": round(score, 1) if score is not None else None,
                }
            )
        return Response(rows)


class StudentTopicDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        topic = get_object_or_404(
            TextbookTopic.objects.select_related("asset").prefetch_related("questions"),
            pk=pk,
            organization_id=request.user.organization_id,
        )
        if not _student_can_use(request.user, topic.asset):
            return Response({"error": "You do not have access to this topic."}, status=403)
        return Response(
            {
                "id": str(topic.id),
                "title": topic.title,
                "chapter_label": topic.chapter_label,
                "page_start": topic.page_start,
                "page_end": topic.page_end,
                "asset": _catalogue(topic.asset),
                "questions": [_question_public(q) for q in topic.questions.all()],
            }
        )


class StudentTopicAttemptView(APIView):
    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def post(self, request, pk):
        topic = get_object_or_404(
            TextbookTopic.objects.select_related("asset").prefetch_related("questions"),
            pk=pk,
            organization_id=request.user.organization_id,
        )
        if request.user.role != UserProfile.Role.STUDENT or not _student_can_use(request.user, topic.asset):
            return Response({"error": "You do not have access to this topic."}, status=403)
        questions = list(topic.questions.all())
        if not questions:
            return Response({"error": "This topic has no questions yet."}, status=400)
        submitted = {
            str(item.get("question_id")): str(item.get("selected_option_id") or "")
            for item in request.data.get("answers") or []
            if isinstance(item, dict)
        }
        attempt = TopicAttempt.objects.create(
            student=request.user, topic=topic, total_count=len(questions)
        )
        correct = 0
        revealed = []
        answers = []
        for question in questions:
            selected = submitted.get(str(question.id), "")
            is_correct = bool(selected) and selected == question.correct_option_id
            if is_correct:
                correct += 1
            answers.append(
                TopicAnswer(
                    attempt=attempt,
                    question=question,
                    selected_option_id=selected,
                    is_correct=is_correct,
                )
            )
            revealed.append(_question_revealed(question, selected, is_correct))
        TopicAnswer.objects.bulk_create(answers)
        score = round(100.0 * correct / len(questions), 1)
        attempt.correct_count = correct
        attempt.score_percent = score
        attempt.save(update_fields=["correct_count", "score_percent"])
        return Response(
            {
                "attempt_id": str(attempt.id),
                "score_percent": score,
                "correct_count": correct,
                "total_count": len(questions),
                "status": topic_status(score),
                "mastery_percent": MASTERY_PERCENT,
                "questions": revealed,
                "asset": _catalogue(topic.asset),
            }
        )


class StudentProgressView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        if user.role != UserProfile.Role.STUDENT:
            return Response({"error": "Progress is available on student accounts."}, status=403)
        week_ago = timezone.now() - timezone.timedelta(days=7)
        books_opened = PdfReadingState.objects.filter(user=user, updated_at__gte=week_ago).count()
        topics = []
        attempts = latest_attempts(user)
        qs = TextbookTopic.objects.filter(organization_id=user.organization_id).select_related("asset")
        for topic in qs:
            if not _student_can_use(user, topic.asset):
                continue
            attempt = attempts.get(topic.id)
            score = attempt.score_percent if attempt else None
            topics.append(
                {
                    "id": str(topic.id),
                    "title": topic.title,
                    "subject": topic.asset.subject,
                    "chapter_label": topic.chapter_label,
                    "status": topic_status(score),
                    "score_percent": round(score, 1) if score is not None else None,
                    "asset_id": str(topic.asset_id),
                    "review_page": topic.page_start,
                }
            )
        return Response(
            {
                "reading_activity": {
                    "books_opened_this_week": books_opened,
                    "note": "Opening pages shows activity, not comprehension.",
                },
                "understanding": {
                    "mastery_percent": MASTERY_PERCENT,
                    "topics": topics,
                },
                "weekly": weekly_summary(user),
            }
        )


class StudentStudyPlanView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        if user.role != UserProfile.Role.STUDENT:
            return Response({"items": []})
        now = timezone.now()
        horizon = now + timezone.timedelta(days=7)
        items = []

        submissions = (
            AssignmentSubmission.objects.filter(student=user, status=AssignmentSubmission.Status.ASSIGNED)
            .select_related("assignment", "assignment__resource")
            .order_by("assignment__due_at")
        )
        for sub in submissions:
            due = sub.assignment.due_at
            if due and due > horizon and due > now:
                continue
            items.append(
                {
                    "kind": "assignment",
                    "id": str(sub.assignment_id),
                    "title": sub.assignment.title,
                    "detail": sub.assignment.resource_pages or sub.assignment.get_kind_display(),
                    "due_at": due.isoformat() if due else None,
                    "overdue": bool(due and due < now),
                }
            )

        states = PdfReadingState.objects.filter(user=user).select_related("asset").order_by("-updated_at")[:8]
        for state in states:
            if not _student_can_use(user, state.asset):
                continue
            items.append(
                {
                    "kind": "reading",
                    "id": str(state.asset_id),
                    "title": state.asset.title,
                    "detail": f"Continue from page {state.page}",
                    "page": state.page,
                    "due_at": None,
                    "overdue": False,
                }
            )

        attempts = latest_attempts(user)
        topics = TextbookTopic.objects.filter(organization_id=user.organization_id).select_related("asset")
        for topic in topics:
            if not _student_can_use(user, topic.asset):
                continue
            attempt = attempts.get(topic.id)
            score = attempt.score_percent if attempt else None
            status_label = topic_status(score)
            if status_label == "mastered":
                continue
            items.append(
                {
                    "kind": "practice",
                    "id": str(topic.id),
                    "title": topic.title,
                    "detail": "Needs another attempt" if status_label == "retry" else "Not practised yet",
                    "asset_id": str(topic.asset_id),
                    "page": topic.page_start,
                    "due_at": None,
                    "overdue": False,
                }
            )

        due_cards = RevisionCard.objects.filter(user=user, next_review_at__lte=now).count()
        if due_cards:
            items.append(
                {
                    "kind": "cards",
                    "id": "cards",
                    "title": f"{due_cards} revision card{'s' if due_cards != 1 else ''} to review",
                    "detail": "Saved from your textbooks",
                    "due_at": None,
                    "overdue": False,
                }
            )

        return Response(
            {
                "week_of": now.date().isoformat(),
                "items": items,
            }
        )


class StudentCardListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        cards = RevisionCard.objects.filter(user=request.user).select_related("asset")
        now = timezone.now()
        return Response(
            [
                {
                    "id": str(card.id),
                    "asset_id": str(card.asset_id),
                    "asset_title": card.asset.title,
                    "page": card.page,
                    "front": card.front,
                    "back": card.back,
                    "box": card.box,
                    "due": card.next_review_at <= now,
                    "next_review_at": card.next_review_at.isoformat(),
                }
                for card in cards
            ]
        )

    def post(self, request):
        asset = _asset_for_school(request.user, request.data.get("asset_id"))
        if not _student_can_use(request.user, asset):
            return Response({"error": "You do not have access to this book."}, status=403)
        front = str(request.data.get("front") or "").strip()
        back = str(request.data.get("back") or "").strip()
        if not front or not back:
            return Response({"error": "A card needs a passage and your note."}, status=400)
        try:
            page = max(1, int(request.data.get("page") or 1))
        except (TypeError, ValueError):
            page = 1
        card = RevisionCard.objects.create(
            user=request.user,
            asset=asset,
            page=page,
            front=front[:2000],
            back=back[:2000],
            next_review_at=timezone.now(),
        )
        return Response({"id": str(card.id)}, status=status.HTTP_201_CREATED)


class StudentCardDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, pk):
        card = get_object_or_404(RevisionCard, pk=pk, user=request.user)
        card.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    def post(self, request, pk):
        """Record a review. Body: {"knew": true|false}."""
        card = get_object_or_404(RevisionCard, pk=pk, user=request.user)
        knew = bool(request.data.get("knew"))
        if knew:
            card.box = min(2, card.box + 1)
        else:
            card.box = 0
        card.next_review_at = timezone.now() + timezone.timedelta(days=REVIEW_INTERVALS_DAYS[card.box])
        card.save(update_fields=["box", "next_review_at", "updated_at"])
        return Response(
            {
                "id": str(card.id),
                "box": card.box,
                "next_review_at": card.next_review_at.isoformat(),
            }
        )


class StudentReadingStateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        asset = _asset_for_school(request.user, pk)
        if not _student_can_use(request.user, asset) and request.user.role == UserProfile.Role.STUDENT:
            return Response({"error": "You do not have access to this book."}, status=403)
        state = PdfReadingState.objects.filter(user=request.user, asset=asset).first()
        if state is None:
            return Response({"page": 1, "updated_at": None, "synced": True})
        return Response(
            {"page": state.page, "updated_at": state.updated_at.isoformat(), "synced": True}
        )

    def put(self, request, pk):
        asset = _asset_for_school(request.user, pk)
        if request.user.role == UserProfile.Role.STUDENT and not _student_can_use(request.user, asset):
            return Response({"error": "You do not have access to this book."}, status=403)
        try:
            page = int(request.data.get("page") or 1)
        except (TypeError, ValueError):
            return Response({"error": "Page must be a number."}, status=400)
        page = max(1, min(page, 10000))
        state, _created = PdfReadingState.objects.update_or_create(
            user=request.user,
            asset=asset,
            defaults={"page": page},
        )
        return Response(
            {"page": state.page, "updated_at": state.updated_at.isoformat(), "synced": True}
        )
