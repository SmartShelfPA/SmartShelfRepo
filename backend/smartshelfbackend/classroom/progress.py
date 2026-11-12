"""Topic mastery and the parent weekly summary.

Reading time is reported separately from quiz scores so progress stays credible.
"""

from __future__ import annotations

from datetime import timedelta

from django.db.models import Avg
from django.utils import timezone

from learning.models import IgcsUserReading, PracticeSession

from .models import AssignmentSubmission, PdfReadingState, TopicAttempt

MASTERY_PERCENT = 70.0


def latest_attempts(student) -> dict:
    """One attempt per topic: the most recent."""
    latest: dict = {}
    rows = (
        TopicAttempt.objects.filter(student=student)
        .select_related("topic", "topic__asset")
        .order_by("completed_at")
    )
    for attempt in rows:
        latest[attempt.topic_id] = attempt
    return latest


def topic_status(score) -> str:
    if score is None:
        return "new"
    return "mastered" if score >= MASTERY_PERCENT else "retry"


def weekly_summary(student, now=None) -> dict:
    now = now or timezone.now()
    week_ago = now - timedelta(days=7)

    completed_assignments = AssignmentSubmission.objects.filter(
        student=student,
        submitted_at__gte=week_ago,
    ).count()
    overdue = AssignmentSubmission.objects.filter(
        student=student,
        status=AssignmentSubmission.Status.ASSIGNED,
        assignment__due_at__lt=now,
    ).count()

    sessions = PracticeSession.objects.filter(
        user=student,
        started_at__gte=week_ago,
        status=PracticeSession.Status.COMPLETED,
    )
    practice_avg = sessions.aggregate(avg=Avg("score_percent"))["avg"]
    books_opened = IgcsUserReading.objects.filter(user=student, last_read_at__gte=week_ago).count()
    books_opened += PdfReadingState.objects.filter(user=student, updated_at__gte=week_ago).count()

    mastered = []
    needs_support = []
    for attempt in latest_attempts(student).values():
        row = {
            "topicId": str(attempt.topic_id),
            "topic": attempt.topic.title,
            "subject": attempt.topic.asset.subject,
            "scorePercent": round(attempt.score_percent, 1),
        }
        if attempt.score_percent >= MASTERY_PERCENT:
            mastered.append(row)
        else:
            needs_support.append(row)

    suggestions = []
    if overdue:
        label = "assignment is" if overdue == 1 else "assignments are"
        suggestions.append(f"{overdue} {label} past the deadline.")
    if needs_support:
        first = needs_support[0]
        suggestions.append(
            f"Review {first['topic']} — last topic score was {first['scorePercent']}%, which is below {int(MASTERY_PERCENT)}%."
        )
    if books_opened and not sessions.exists() and not mastered:
        suggestions.append(
            "Books were opened this week. That shows study activity. A short topic quiz is what shows understanding."
        )
    if not suggestions and (completed_assignments or mastered):
        suggestions.append("Completed work looks steady this week.")
    if not suggestions:
        suggestions.append("No completed assignments or topic quizzes this week yet.")

    return {
        "assignmentsCompleted": completed_assignments,
        "overdueAssignments": overdue,
        "practiceSessions": sessions.count(),
        "practiceAvgPercent": round(practice_avg, 1) if practice_avg is not None else None,
        "booksOpened": books_opened,
        "readingNote": "Opening a book or spending time in it shows activity, not comprehension.",
        "topicsMastered": len(mastered),
        "topicsNeedingSupport": needs_support[:5],
        "supportSuggestions": suggestions[:3],
    }
