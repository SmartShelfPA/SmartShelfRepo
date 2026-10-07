"""Assignment recipients and marking."""

from __future__ import annotations

from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from django.utils import timezone

from learning.models import PracticeSession
from users.models import UserProfile

from .models import Assignment, AssignmentAnswer, AssignmentQuestion, AssignmentSubmission


class SubmissionError(Exception):
    pass


def resolve_recipients(organization, target_class: str, student_ids) -> list[UserProfile]:
    qs = UserProfile.objects.filter(
        organization=organization, role=UserProfile.Role.STUDENT, is_active=True
    )
    recipients: dict = {}
    if target_class:
        for s in qs.filter(student_class__iexact=target_class.strip()):
            recipients[s.pk] = s
    if student_ids:
        for s in qs.filter(pk__in=list(student_ids)):
            recipients[s.pk] = s
    return list(recipients.values())


def _recompute_totals(submission: AssignmentSubmission) -> None:
    max_marks = submission.assignment.max_marks
    answers = list(AssignmentAnswer.objects.filter(submission=submission))
    awarded = sum(a.awarded_marks or 0 for a in answers)
    submission.awarded_marks = awarded
    submission.score_percent = round(awarded / max_marks * 100, 1) if max_marks else None


@transaction.atomic
def submit_questions(submission: AssignmentSubmission, answers_payload: list[dict]) -> AssignmentSubmission:
    questions = {str(q.id): q for q in submission.assignment.questions.all()}
    if not questions:
        raise SubmissionError("This assignment has no questions.")

    given = {}
    for item in answers_payload or []:
        qid = str(item.get("question_id") or "")
        if qid in questions:
            given[qid] = item

    submission.answers.all().delete()
    needs_teacher = False
    for qid, question in questions.items():
        item = given.get(qid, {})
        selected = str(item.get("selected_option_id") or "").strip()[:16]
        text = str(item.get("text_answer") or "").strip()[:20000]
        answer = AssignmentAnswer(submission=submission, question=question)
        if question.kind == AssignmentQuestion.Kind.MULTIPLE_CHOICE:
            answer.selected_option_id = selected
            answer.is_correct = bool(selected) and selected == question.correct_option_id
            answer.awarded_marks = float(question.max_marks) if answer.is_correct else 0.0
        else:
            answer.text_answer = text
            if text:
                needs_teacher = True
            else:
                answer.awarded_marks = 0.0
        answer.save()

    now = timezone.now()
    submission.submitted_at = now
    _recompute_totals(submission)
    if needs_teacher:
        submission.status = AssignmentSubmission.Status.SUBMITTED
        submission.graded_at = None
    else:
        submission.status = AssignmentSubmission.Status.GRADED
        submission.graded_at = now
    submission.save()
    return submission


def submit_practice(submission: AssignmentSubmission, session_id) -> AssignmentSubmission:
    assignment = submission.assignment
    try:
        session = PracticeSession.objects.filter(pk=session_id, user=submission.student).first()
    except (DjangoValidationError, ValueError):
        session = None
    if session is None:
        raise SubmissionError("Practice session not found.")
    if session.status != PracticeSession.Status.COMPLETED:
        raise SubmissionError("Finish the practice session before submitting it.")
    if assignment.exam_type and session.exam_type != assignment.exam_type:
        raise SubmissionError(f"This assignment needs a {assignment.exam_type} session.")
    if assignment.subject and session.subject.strip().lower() != assignment.subject.strip().lower():
        raise SubmissionError(f"This assignment needs a {assignment.subject} session.")

    now = timezone.now()
    submission.practice_session = session
    submission.score_percent = round(session.score_percent, 1)
    submission.awarded_marks = float(session.correct_count)
    submission.status = AssignmentSubmission.Status.GRADED
    submission.submitted_at = now
    submission.graded_at = now
    submission.save()
    return submission


def submit_reading(submission: AssignmentSubmission, response_text: str) -> AssignmentSubmission:
    submission.response_text = (response_text or "").strip()[:20000]
    submission.status = AssignmentSubmission.Status.SUBMITTED
    submission.submitted_at = timezone.now()
    submission.save()
    return submission


@transaction.atomic
def grade_submission(submission: AssignmentSubmission, grader, answers: list[dict], feedback: str | None) -> AssignmentSubmission:
    by_id = {str(a.id): a for a in submission.answers.select_related("question")}
    for item in answers or []:
        answer = by_id.get(str(item.get("answer_id") or ""))
        if answer is None:
            continue
        if "awarded_marks" in item and item["awarded_marks"] is not None:
            try:
                marks = float(item["awarded_marks"])
            except (TypeError, ValueError):
                raise SubmissionError("awarded_marks must be a number.")
            answer.awarded_marks = min(float(answer.question.max_marks), max(0.0, marks))
        if "feedback" in item:
            answer.feedback = str(item.get("feedback") or "")[:5000]
        answer.save()

    if feedback is not None:
        submission.teacher_feedback = feedback[:5000]
    if submission.assignment.kind == Assignment.Kind.QUESTIONS:
        _recompute_totals(submission)
    submission.status = AssignmentSubmission.Status.GRADED
    submission.graded_at = timezone.now()
    submission.graded_by = grader
    submission.save()
    return submission
