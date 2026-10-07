"""Teacher-set assignments: create, track, mark; student view and submission."""

from __future__ import annotations

import csv

from django.db import transaction
from django.db.models import Prefetch
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from learning.models import ProtectedPdfAsset
from users.models import UserProfile
from users.permissions import IsStaffRole, IsStudentRole

from .models import Assignment, AssignmentQuestion, AssignmentSubmission
from .serializers import (
    AssignmentCreateSerializer,
    AssignmentUpdateSerializer,
    assignment_summary,
    question_payload,
    student_assignment_payload,
    submission_payload,
)
from .services import (
    SubmissionError,
    grade_submission,
    resolve_recipients,
    submit_practice,
    submit_questions,
    submit_reading,
)


def _staff_assignments(user):
    qs = Assignment.objects.filter(organization_id=user.organization_id).select_related(
        "resource", "created_by"
    ).prefetch_related("submissions", "questions")
    if not user.is_school_admin:
        qs = qs.filter(created_by=user)
    return qs


def _require_org(user):
    if not user.organization_id:
        return Response(
            {"error": "Your account is not linked to a school."}, status=status.HTTP_400_BAD_REQUEST
        )
    return None


class StaffRosterView(APIView):
    """GET /api/v1/staff/roster/ — classes and students in the teacher's school."""

    permission_classes = [IsAuthenticated, IsStaffRole]

    def get(self, request):
        err = _require_org(request.user)
        if err:
            return err
        students = UserProfile.objects.filter(
            organization_id=request.user.organization_id,
            role=UserProfile.Role.STUDENT,
            is_active=True,
        ).order_by("student_class", "full_name", "username")
        classes: dict[str, list] = {}
        for s in students:
            name = (s.student_class or "").strip() or "Unassigned"
            classes.setdefault(name, []).append(
                {"id": str(s.id), "name": s.full_name or s.username, "username": s.username}
            )
        return Response(
            {"classes": [{"name": k, "students": v} for k, v in sorted(classes.items())]}
        )


class StaffAssignmentListCreateView(APIView):
    permission_classes = [IsAuthenticated, IsStaffRole]

    def get(self, request):
        err = _require_org(request.user)
        if err:
            return err
        return Response([assignment_summary(a) for a in _staff_assignments(request.user)])

    @transaction.atomic
    def post(self, request):
        err = _require_org(request.user)
        if err:
            return err
        ser = AssignmentCreateSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        data = ser.validated_data
        org = request.user.organization

        resource = None
        if data.get("resource_id"):
            resource = ProtectedPdfAsset.objects.filter(pk=data["resource_id"]).first()
            if resource is None or not resource.user_can_access(request.user):
                return Response({"error": "Resource not found."}, status=status.HTTP_400_BAD_REQUEST)

        recipients = resolve_recipients(org, data.get("target_class", ""), data.get("student_ids"))
        if not recipients:
            return Response(
                {"error": "No students found in that class or selection."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        assignment = Assignment.objects.create(
            organization=org,
            created_by=request.user,
            title=data["title"].strip(),
            instructions=(data.get("instructions") or "").strip(),
            kind=data["kind"],
            target_class=(data.get("target_class") or "").strip(),
            exam_type=data.get("exam_type") or "",
            subject=(data.get("subject") or "").strip(),
            year=data.get("year"),
            question_count=data.get("question_count") or 10,
            resource=resource,
            resource_pages=(data.get("resource_pages") or "").strip(),
            due_at=data.get("due_at"),
        )
        for idx, q in enumerate(data.get("questions") or []):
            AssignmentQuestion.objects.create(
                assignment=assignment,
                order=idx,
                kind=q["kind"],
                prompt=q["prompt"].strip(),
                options=q.get("options") or [],
                correct_option_id=q.get("correct_option_id") or "",
                marking_guide=(q.get("marking_guide") or "").strip(),
                max_marks=q.get("max_marks") or 1,
            )
        AssignmentSubmission.objects.bulk_create(
            [AssignmentSubmission(assignment=assignment, student=s) for s in recipients]
        )
        assignment = _staff_assignments(request.user).get(pk=assignment.pk)
        return Response(assignment_summary(assignment), status=status.HTTP_201_CREATED)


class StaffAssignmentDetailView(APIView):
    permission_classes = [IsAuthenticated, IsStaffRole]

    def _get(self, request, pk):
        return get_object_or_404(_staff_assignments(request.user), pk=pk)

    def get(self, request, pk):
        assignment = self._get(request, pk)
        subs = assignment.submissions.select_related("student").prefetch_related("answers")
        return Response(
            {
                **assignment_summary(assignment),
                "questions": [question_payload(q, reveal=True) for q in assignment.questions.all()],
                "submissions": [submission_payload(s) for s in subs],
            }
        )

    def patch(self, request, pk):
        assignment = self._get(request, pk)
        ser = AssignmentUpdateSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        for field, value in ser.validated_data.items():
            setattr(assignment, field, value.strip() if isinstance(value, str) else value)
        assignment.save()
        return Response(assignment_summary(assignment))

    def delete(self, request, pk):
        self._get(request, pk).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class StaffAssignmentExportView(APIView):
    """GET /api/v1/staff/assignments/<id>/export/ — CSV gradebook for importing into an LMS."""

    permission_classes = [IsAuthenticated, IsStaffRole]

    def get(self, request, pk):
        assignment = get_object_or_404(_staff_assignments(request.user), pk=pk)
        response = HttpResponse(content_type="text/csv")
        safe_title = "".join(c if c.isalnum() else "_" for c in assignment.title)[:60] or "assignment"
        response["Content-Disposition"] = f'attachment; filename="{safe_title}_grades.csv"'
        writer = csv.writer(response)
        writer.writerow(
            [
                "student_name", "username", "email", "class", "assignment", "status",
                "score_percent", "marks", "max_marks", "submitted_at", "graded_at", "feedback",
            ]
        )
        max_marks = assignment.max_marks if assignment.kind == Assignment.Kind.QUESTIONS else ""
        for s in assignment.submissions.select_related("student"):
            writer.writerow(
                [
                    s.student.full_name, s.student.username, s.student.email, s.student.student_class,
                    assignment.title, s.get_status_display(),
                    "" if s.score_percent is None else s.score_percent,
                    "" if s.awarded_marks is None else s.awarded_marks,
                    max_marks,
                    s.submitted_at.isoformat() if s.submitted_at else "",
                    s.graded_at.isoformat() if s.graded_at else "",
                    s.teacher_feedback,
                ]
            )
        return response


class StaffSubmissionDetailView(APIView):
    """GET/PATCH /api/v1/staff/submissions/<id>/ — view a student's work and mark it."""

    permission_classes = [IsAuthenticated, IsStaffRole]

    def _get(self, request, pk):
        assignments = _staff_assignments(request.user)
        return get_object_or_404(
            AssignmentSubmission.objects.select_related("student", "assignment").prefetch_related(
                "answers"
            ),
            pk=pk,
            assignment__in=assignments,
        )

    def get(self, request, pk):
        s = self._get(request, pk)
        return Response(
            {
                **submission_payload(s, include_answers=True),
                "assignment": assignment_summary(s.assignment),
                "questions": [question_payload(q, reveal=True) for q in s.assignment.questions.all()],
            }
        )

    def patch(self, request, pk):
        s = self._get(request, pk)
        if s.status == AssignmentSubmission.Status.ASSIGNED:
            return Response(
                {"error": "The student has not submitted this yet."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        feedback = request.data.get("teacher_feedback")
        try:
            grade_submission(
                s,
                request.user,
                request.data.get("answers") or [],
                None if feedback is None else str(feedback),
            )
        except SubmissionError as exc:
            return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        s = self._get(request, pk)
        return Response(submission_payload(s, include_answers=True))


def _student_submissions(user):
    return AssignmentSubmission.objects.filter(student=user).select_related(
        "assignment", "assignment__resource", "assignment__created_by"
    ).prefetch_related(
        "answers",
        Prefetch("assignment__questions", queryset=AssignmentQuestion.objects.order_by("order")),
    ).order_by("-assignment__created_at")


class StudentAssignmentListView(APIView):
    permission_classes = [IsAuthenticated, IsStudentRole]

    def get(self, request):
        return Response(
            [student_assignment_payload(s.assignment, s) for s in _student_submissions(request.user)]
        )


class StudentAssignmentDetailView(APIView):
    permission_classes = [IsAuthenticated, IsStudentRole]

    def get(self, request, pk):
        s = get_object_or_404(_student_submissions(request.user), assignment_id=pk)
        return Response(student_assignment_payload(s.assignment, s, detail=True))


class StudentAssignmentSubmitView(APIView):
    """POST /api/v1/student/assignments/<id>/submit/"""

    permission_classes = [IsAuthenticated, IsStudentRole]

    def post(self, request, pk):
        s = get_object_or_404(_student_submissions(request.user), assignment_id=pk)
        if s.status == AssignmentSubmission.Status.GRADED and s.assignment.kind != Assignment.Kind.PRACTICE:
            return Response(
                {"error": "Your teacher has already marked this assignment."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        kind = s.assignment.kind
        try:
            if kind == Assignment.Kind.QUESTIONS:
                submit_questions(s, request.data.get("answers") or [])
            elif kind == Assignment.Kind.PRACTICE:
                session_id = request.data.get("practice_session_id")
                if not session_id:
                    return Response(
                        {"error": "practice_session_id is required."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                submit_practice(s, session_id)
            else:
                submit_reading(s, request.data.get("response_text") or "")
        except SubmissionError as exc:
            return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        except (ValueError, TypeError):
            return Response({"error": "Invalid submission."}, status=status.HTTP_400_BAD_REQUEST)
        s = get_object_or_404(_student_submissions(request.user), pk=s.pk)
        return Response(student_assignment_payload(s.assignment, s, detail=True))
