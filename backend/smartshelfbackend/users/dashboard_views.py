"""Parent and staff (teacher) dashboard APIs."""

from __future__ import annotations

from collections import defaultdict
from datetime import timedelta

from django.db.models import Avg
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from classroom.models import Assignment, AssignmentSubmission
from learning.models import IgcsUserReading, PracticeSession

from .models import ReadingProgress, TeacherNote, UserProfile
from .permissions import IsParentRole, IsStaffRole


def _student_status(student, reading_qs, practice_qs, now) -> str:
    week_ago = now - timedelta(days=7)
    recent_read = reading_qs.filter(user=student, last_read_at__gte=week_ago).exists()
    recent_practice = practice_qs.filter(user=student, started_at__gte=week_ago).exists()
    if not recent_read and not recent_practice:
        last_read = reading_qs.filter(user=student).order_by("-last_read_at").first()
        if last_read and last_read.last_read_at and last_read.last_read_at < now - timedelta(days=14):
            return "inactive"
        return "inactive" if not last_read else "falling_behind"

    avg_score = (
        practice_qs.filter(user=student, status=PracticeSession.Status.COMPLETED)
        .aggregate(avg=Avg("score_percent"))
        .get("avg")
    )
    if avg_score is not None and avg_score < 50:
        return "needs_review"
    completed = reading_qs.filter(user=student, status=ReadingProgress.Status.COMPLETED).count()
    in_progress = reading_qs.filter(user=student, status=ReadingProgress.Status.READING).count()
    if in_progress == 0 and completed == 0:
        return "falling_behind"
    return "on_track"


def _parent_child_summary(child, now) -> dict:
    week_ago = now - timedelta(days=7)

    readings = list(
        IgcsUserReading.objects.filter(user=child).select_related("book").order_by("-last_read_at")[:8]
    )
    sessions = PracticeSession.objects.filter(user=child).order_by("-started_at")
    completed_sessions = sessions.filter(status=PracticeSession.Status.COMPLETED)
    avg_score = completed_sessions.aggregate(avg=Avg("score_percent"))["avg"]

    submissions = list(
        AssignmentSubmission.objects.filter(student=child)
        .select_related("assignment", "assignment__created_by")
        .order_by("-assignment__created_at")[:15]
    )
    pending = [s for s in submissions if s.status == AssignmentSubmission.Status.ASSIGNED]
    done = [s for s in submissions if s.status != AssignmentSubmission.Status.ASSIGNED]

    notes = TeacherNote.objects.filter(student=child, shared_with_parent=True).select_related(
        "teacher"
    )[:10]

    candidates = [r.last_read_at for r in readings if r.last_read_at]
    first_session = sessions.first()
    if first_session:
        candidates.append(first_session.started_at)
    candidates += [s.submitted_at for s in done if s.submitted_at]
    last_active = max(candidates) if candidates else None

    overdue = [s for s in pending if s.assignment.due_at and s.assignment.due_at < now]
    if overdue:
        status_label = "needs_attention"
    elif last_active is None or last_active < week_ago:
        status_label = "inactive"
    elif avg_score is not None and avg_score < 50:
        status_label = "needs_review"
    else:
        status_label = "on_track"

    return {
        "id": str(child.id),
        "name": child.full_name or child.username,
        "className": child.student_class,
        "schoolName": child.organization.name if child.organization else "",
        "status": status_label,
        "lastActiveAt": last_active.isoformat() if last_active else None,
        "currentTasks": len(pending),
        "completedTasks": len(done),
        "shelfId": str(child.id),
        "reading": [
            {
                "id": str(r.id),
                "title": r.book.title,
                "progressPercent": r.progress_percent,
                "lastReadAt": r.last_read_at.isoformat() if r.last_read_at else None,
            }
            for r in readings
        ],
        "practice": {
            "sessionsThisWeek": sessions.filter(started_at__gte=week_ago).count(),
            "completedSessions": completed_sessions.count(),
            "avgScorePercent": round(avg_score, 1) if avg_score is not None else None,
            "recent": [
                {
                    "id": str(s.id),
                    "examType": s.exam_type,
                    "subject": s.subject,
                    "year": s.year,
                    "scorePercent": round(s.score_percent, 1),
                    "startedAt": s.started_at.isoformat(),
                }
                for s in completed_sessions[:5]
            ],
        },
        "assignments": [
            {
                "id": str(s.assignment_id),
                "title": s.assignment.title,
                "kind": s.assignment.kind,
                "teacherName": (s.assignment.created_by.full_name or s.assignment.created_by.username)
                if s.assignment.created_by
                else "",
                "dueAt": s.assignment.due_at.isoformat() if s.assignment.due_at else None,
                "status": s.status,
                "isOverdue": s in overdue,
                "scorePercent": s.score_percent,
                "teacherFeedback": s.teacher_feedback,
                "submittedAt": s.submitted_at.isoformat() if s.submitted_at else None,
            }
            for s in submissions
        ],
        "teacherNotes": [
            {
                "id": str(n.id),
                "teacherName": n.teacher.full_name or n.teacher.username,
                "note": n.note,
                "createdAt": n.created_at.isoformat(),
            }
            for n in notes
        ],
    }


class ParentDashboardView(APIView):
    """GET /api/v1/parent/dashboard/ — only children linked to this parent via invite."""

    permission_classes = [IsAuthenticated, IsParentRole]

    def get(self, request):
        user = request.user
        now = timezone.now()
        children = list(
            user.managed_students.filter(role=UserProfile.Role.STUDENT).select_related("organization")
        )
        child_rows = [_parent_child_summary(child, now) for child in children]
        return Response(
            {
                "parentName": user.full_name or user.username,
                "totalChildren": len(children),
                "totalItemsTracked": sum(
                    len(c["assignments"]) + len(c["reading"]) for c in child_rows
                ),
                "children": child_rows,
                "itemsByChild": {},
            }
        )


class StaffDashboardView(APIView):
    permission_classes = [IsAuthenticated, IsStaffRole]

    def get(self, request):
        teacher = request.user
        now = timezone.now()
        week_ago = now - timedelta(days=7)

        if not teacher.organization_id:
            return Response(
                {"error": "Your account is not linked to a school."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        students = UserProfile.objects.filter(
            organization=teacher.organization,
            role=UserProfile.Role.STUDENT,
            is_active=True,
        ).order_by("full_name", "username")

        reading_qs = ReadingProgress.objects.select_related("book")
        practice_qs = PracticeSession.objects.all()

        classes_map: dict[str, list] = defaultdict(list)
        for s in students:
            cls = (s.student_class or "Unassigned").strip() or "Unassigned"
            classes_map[cls].append(s)

        class_rows = []
        all_students = []
        interventions = []

        for cls_name, cls_students in sorted(classes_map.items()):
            active = 0
            completion_rates = []
            weak_topics: dict[str, int] = defaultdict(int)
            study_minutes = []

            for student in cls_students:
                st_reading = reading_qs.filter(user=student)
                st_practice = practice_qs.filter(user=student)
                status_label = _student_status(student, reading_qs, practice_qs, now)

                if st_reading.filter(last_read_at__gte=week_ago).exists() or st_practice.filter(
                    started_at__gte=week_ago
                ).exists():
                    active += 1

                for p in st_reading:
                    if p.book.page_count > 0:
                        completion_rates.append(p.percent_complete)

                low_sessions = st_practice.filter(
                    status=PracticeSession.Status.COMPLETED, score_percent__lt=55
                )
                for sess in low_sessions[:3]:
                    weak_topics[sess.subject] += 1

                read_mins = sum(
                    max(1, int((p.current_page or 0) * 2)) for p in st_reading.filter(last_read_at__gte=week_ago)
                )
                practice_mins = (
                    st_practice.filter(started_at__gte=week_ago).aggregate(
                        total=Avg("duration_seconds")
                    )["total"]
                    or 0
                )
                study_minutes.append(read_mins + int(practice_mins / 60))

                books_opened = st_reading.exclude(status=ReadingProgress.Status.TO_READ).count()
                chapters_read = st_reading.filter(status=ReadingProgress.Status.COMPLETED).count()
                avg_quiz = (
                    st_practice.filter(status=PracticeSession.Status.COMPLETED).aggregate(
                        avg=Avg("score_percent")
                    )["avg"]
                )
                last_active = st_reading.order_by("-last_read_at").first()
                last_practice = st_practice.order_by("-started_at").first()
                last_ts = None
                if last_active and last_active.last_read_at:
                    last_ts = last_active.last_read_at
                if last_practice and (not last_ts or last_practice.started_at > last_ts):
                    last_ts = last_practice.started_at

                strengths, weaknesses = [], []
                subject_scores: dict[str, list] = defaultdict(list)
                for sess in st_practice.filter(status=PracticeSession.Status.COMPLETED)[:20]:
                    subject_scores[sess.subject].append(sess.score_percent)
                for subj, scores in subject_scores.items():
                    avg = sum(scores) / len(scores)
                    if avg >= 70:
                        strengths.append(subj)
                    elif avg < 55:
                        weaknesses.append(subj)

                student_row = {
                    "id": str(student.id),
                    "classId": cls_name,
                    "className": cls_name,
                    "name": student.full_name or student.username,
                    "status": status_label,
                    "lastActiveAt": last_ts.isoformat() if last_ts else None,
                    "booksOpened": books_opened,
                    "chaptersRead": chapters_read,
                    "readingMinutes": read_mins,
                    "avgQuizScore": round(avg_quiz, 1) if avg_quiz is not None else None,
                    "assignmentsSubmitted": AssignmentSubmission.objects.filter(student=student)
                    .exclude(status=AssignmentSubmission.Status.ASSIGNED)
                    .count(),
                    "strengths": strengths[:3],
                    "weaknesses": weaknesses[:3],
                }
                all_students.append(student_row)

                if status_label == "inactive":
                    interventions.append(
                        {
                            "id": f"inactive-{student.id}",
                            "studentId": str(student.id),
                            "studentName": student_row["name"],
                            "flag": "Low activity",
                            "severity": "high",
                            "reason": "No reading or practice in the past week.",
                        }
                    )
                elif status_label == "needs_review":
                    interventions.append(
                        {
                            "id": f"quiz-{student.id}",
                            "studentId": str(student.id),
                            "studentName": student_row["name"],
                            "flag": "Low quiz scores",
                            "severity": "medium",
                            "reason": "Recent practice scores are below 50%.",
                        }
                    )
                elif status_label == "falling_behind":
                    interventions.append(
                        {
                            "id": f"behind-{student.id}",
                            "studentId": str(student.id),
                            "studentName": student_row["name"],
                            "flag": "Incomplete reading",
                            "severity": "medium",
                            "reason": "Little or no reading progress recorded.",
                        }
                    )

            top_weak = [k for k, _ in sorted(weak_topics.items(), key=lambda x: -x[1])[:3]]
            avg_completion = (
                round(sum(completion_rates) / len(completion_rates), 1) if completion_rates else 0
            )
            avg_study = round(sum(study_minutes) / len(study_minutes), 0) if study_minutes else 0

            class_rows.append(
                {
                    "id": cls_name,
                    "name": cls_name,
                    "totalStudents": len(cls_students),
                    "activeThisWeek": active,
                    "avgStudyMinutes": int(avg_study),
                    "avgCompletionRate": avg_completion,
                    "topWeakTopics": top_weak or ["No data yet"],
                }
            )

        assignment_qs = Assignment.objects.filter(organization_id=teacher.organization_id)
        if not teacher.is_school_admin:
            assignment_qs = assignment_qs.filter(created_by=teacher)
        assignments = []
        for a in assignment_qs.select_related("resource").prefetch_related("submissions")[:15]:
            subs = list(a.submissions.all())
            scores = [s.score_percent for s in subs if s.score_percent is not None]
            assignments.append(
                {
                    "id": str(a.id),
                    "title": a.title,
                    "textbook": a.resource.title if a.resource else (a.subject or a.get_kind_display()),
                    "chapter": a.resource_pages or (f"{a.exam_type} {a.year or ''}".strip() if a.exam_type else ""),
                    "assignedAt": a.created_at.isoformat(),
                    "startedCount": sum(
                        1 for s in subs if s.status != AssignmentSubmission.Status.ASSIGNED
                    ),
                    "completedCount": sum(
                        1 for s in subs if s.status == AssignmentSubmission.Status.GRADED
                    ),
                    "totalStudents": len(subs),
                    "avgScore": round(sum(scores) / len(scores), 1) if scores else None,
                    "className": a.target_class or "Selected students",
                }
            )

        notes = [
            {
                "id": str(n.id),
                "studentId": str(n.student_id),
                "studentName": n.student.full_name or n.student.username,
                "note": n.note,
                "sharedWithParent": n.shared_with_parent,
                "createdAt": n.created_at.isoformat(),
            }
            for n in TeacherNote.objects.filter(teacher=teacher).select_related("student")[:50]
        ]

        trends = []
        for i in range(4, -1, -1):
            start = now - timedelta(days=(i + 1) * 7)
            end = now - timedelta(days=i * 7)
            week_sessions = practice_qs.filter(
                user__in=students,
                started_at__gte=start,
                started_at__lt=end,
                status=PracticeSession.Status.COMPLETED,
            )
            avg_score = week_sessions.aggregate(avg=Avg("score_percent"))["avg"] or 0
            read_count = reading_qs.filter(
                user__in=students, last_read_at__gte=start, last_read_at__lt=end
            ).count()
            trends.append(
                {
                    "weekLabel": f"Week {5 - i}",
                    "classAvgScore": round(avg_score, 1),
                    "classAvgMinutes": read_count * 15,
                }
            )

        return Response(
            {
                "teacherName": teacher.full_name or teacher.username,
                "staffRole": teacher.staff_role or "Teacher",
                "classes": class_rows,
                "students": all_students,
                "assignments": assignments[:15],
                "interventions": interventions[:20],
                "notes": notes,
                "progressTrends": trends,
            }
        )


class StaffNoteCreateView(APIView):
    permission_classes = [IsAuthenticated, IsStaffRole]

    def post(self, request):
        student_id = request.data.get("student_id")
        note_text = (request.data.get("note") or "").strip()
        shared = bool(request.data.get("shared_with_parent", False))

        if not student_id or not note_text:
            return Response(
                {"error": "student_id and note are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            student = UserProfile.objects.get(
                pk=student_id,
                organization=request.user.organization,
                role=UserProfile.Role.STUDENT,
            )
        except UserProfile.DoesNotExist:
            return Response({"error": "Student not found."}, status=status.HTTP_404_NOT_FOUND)

        note = TeacherNote.objects.create(
            teacher=request.user,
            student=student,
            note=note_text,
            shared_with_parent=shared,
        )
        return Response(
            {
                "id": str(note.id),
                "studentId": str(student.id),
                "studentName": student.full_name or student.username,
                "note": note.note,
                "sharedWithParent": note.shared_with_parent,
                "createdAt": note.created_at.isoformat(),
            },
            status=status.HTTP_201_CREATED,
        )
