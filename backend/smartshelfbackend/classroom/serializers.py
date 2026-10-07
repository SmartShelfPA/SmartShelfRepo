from __future__ import annotations

from rest_framework import serializers

from learning.models import ProtectedPdfAsset

from .models import Assignment, AssignmentAnswer, AssignmentQuestion, AssignmentSubmission

MAX_QUESTIONS = 50


class QuestionWriteSerializer(serializers.Serializer):
    kind = serializers.ChoiceField(choices=AssignmentQuestion.Kind.choices)
    prompt = serializers.CharField(max_length=5000)
    options = serializers.ListField(child=serializers.DictField(), required=False, default=list)
    correct_option_id = serializers.CharField(required=False, allow_blank=True, max_length=16)
    marking_guide = serializers.CharField(required=False, allow_blank=True, max_length=5000)
    max_marks = serializers.IntegerField(required=False, min_value=1, max_value=100, default=1)

    def validate(self, attrs):
        if attrs["kind"] != AssignmentQuestion.Kind.MULTIPLE_CHOICE:
            attrs["options"] = []
            attrs["correct_option_id"] = ""
            return attrs
        options = []
        for idx, raw in enumerate(attrs.get("options") or []):
            label = str(raw.get("label") or "").strip()
            if not label:
                continue
            opt_id = str(raw.get("id") or chr(ord("A") + idx)).strip()[:16]
            options.append({"id": opt_id, "label": label[:1000]})
        if len(options) < 2:
            raise serializers.ValidationError("Multiple choice questions need at least two options.")
        ids = [o["id"] for o in options]
        if len(set(ids)) != len(ids):
            raise serializers.ValidationError("Option ids must be unique.")
        if attrs.get("correct_option_id") not in ids:
            raise serializers.ValidationError("Pick the correct option for each multiple choice question.")
        attrs["options"] = options
        return attrs


class AssignmentCreateSerializer(serializers.Serializer):
    title = serializers.CharField(max_length=200)
    instructions = serializers.CharField(required=False, allow_blank=True, max_length=5000)
    kind = serializers.ChoiceField(choices=Assignment.Kind.choices)
    target_class = serializers.CharField(required=False, allow_blank=True, max_length=120)
    student_ids = serializers.ListField(child=serializers.UUIDField(), required=False, default=list)
    exam_type = serializers.ChoiceField(choices=["WAEC", "JAMB"], required=False, allow_blank=True)
    subject = serializers.CharField(required=False, allow_blank=True, max_length=120)
    year = serializers.IntegerField(required=False, allow_null=True, min_value=1980, max_value=2100)
    question_count = serializers.IntegerField(required=False, min_value=1, max_value=60, default=10)
    resource_id = serializers.UUIDField(required=False, allow_null=True)
    resource_pages = serializers.CharField(required=False, allow_blank=True, max_length=120)
    due_at = serializers.DateTimeField(required=False, allow_null=True)
    questions = QuestionWriteSerializer(many=True, required=False, default=list)

    def validate(self, attrs):
        if not (attrs.get("target_class") or "").strip() and not attrs.get("student_ids"):
            raise serializers.ValidationError("Choose a class or at least one student.")
        kind = attrs["kind"]
        if kind == Assignment.Kind.PRACTICE:
            if not attrs.get("exam_type") or not (attrs.get("subject") or "").strip():
                raise serializers.ValidationError("Practice assignments need an exam and a subject.")
        if kind == Assignment.Kind.READING:
            if not attrs.get("resource_id") and not (attrs.get("instructions") or "").strip():
                raise serializers.ValidationError(
                    "Reading assignments need a resource or instructions describing what to read."
                )
        if kind == Assignment.Kind.QUESTIONS:
            questions = attrs.get("questions") or []
            if not questions:
                raise serializers.ValidationError("Add at least one question.")
            if len(questions) > MAX_QUESTIONS:
                raise serializers.ValidationError(f"At most {MAX_QUESTIONS} questions per assignment.")
        else:
            attrs["questions"] = []
        return attrs


class AssignmentUpdateSerializer(serializers.Serializer):
    title = serializers.CharField(required=False, max_length=200)
    instructions = serializers.CharField(required=False, allow_blank=True, max_length=5000)
    due_at = serializers.DateTimeField(required=False, allow_null=True)
    resource_pages = serializers.CharField(required=False, allow_blank=True, max_length=120)


def _resource_payload(resource: ProtectedPdfAsset | None):
    if resource is None:
        return None
    return {"id": str(resource.id), "title": resource.title, "subject": resource.subject}


def question_payload(q: AssignmentQuestion, *, reveal: bool) -> dict:
    data = {
        "id": str(q.id),
        "order": q.order,
        "kind": q.kind,
        "prompt": q.prompt,
        "options": q.options,
        "max_marks": q.max_marks,
    }
    if reveal:
        data["correct_option_id"] = q.correct_option_id
        data["marking_guide"] = q.marking_guide
    return data


def answer_payload(a: AssignmentAnswer) -> dict:
    return {
        "id": str(a.id),
        "question_id": str(a.question_id),
        "selected_option_id": a.selected_option_id,
        "text_answer": a.text_answer,
        "is_correct": a.is_correct,
        "awarded_marks": a.awarded_marks,
        "feedback": a.feedback,
    }


def submission_payload(s: AssignmentSubmission, *, include_answers: bool = False) -> dict:
    data = {
        "id": str(s.id),
        "student_id": str(s.student_id),
        "student_name": s.student.full_name or s.student.username,
        "student_class": s.student.student_class,
        "status": s.status,
        "score_percent": s.score_percent,
        "awarded_marks": s.awarded_marks,
        "response_text": s.response_text,
        "teacher_feedback": s.teacher_feedback,
        "practice_session_id": str(s.practice_session_id) if s.practice_session_id else None,
        "submitted_at": s.submitted_at.isoformat() if s.submitted_at else None,
        "graded_at": s.graded_at.isoformat() if s.graded_at else None,
    }
    if include_answers:
        data["answers"] = [answer_payload(a) for a in s.answers.all()]
    return data


def assignment_summary(a: Assignment) -> dict:
    subs = list(a.submissions.all())
    scores = [s.score_percent for s in subs if s.score_percent is not None]
    return {
        "id": str(a.id),
        "title": a.title,
        "kind": a.kind,
        "instructions": a.instructions,
        "target_class": a.target_class,
        "exam_type": a.exam_type,
        "subject": a.subject,
        "year": a.year,
        "question_count": a.question_count,
        "resource": _resource_payload(a.resource),
        "resource_pages": a.resource_pages,
        "due_at": a.due_at.isoformat() if a.due_at else None,
        "created_at": a.created_at.isoformat(),
        "created_by_name": (a.created_by.full_name or a.created_by.username) if a.created_by else "",
        "total_students": len(subs),
        "submitted_count": sum(1 for s in subs if s.status != AssignmentSubmission.Status.ASSIGNED),
        "awaiting_marking_count": sum(1 for s in subs if s.status == AssignmentSubmission.Status.SUBMITTED),
        "graded_count": sum(1 for s in subs if s.status == AssignmentSubmission.Status.GRADED),
        "avg_score_percent": round(sum(scores) / len(scores), 1) if scores else None,
    }


def student_assignment_payload(a: Assignment, s: AssignmentSubmission, *, detail: bool = False) -> dict:
    data = {
        "id": str(a.id),
        "title": a.title,
        "kind": a.kind,
        "instructions": a.instructions,
        "exam_type": a.exam_type,
        "subject": a.subject,
        "year": a.year,
        "question_count": a.question_count,
        "resource": _resource_payload(a.resource),
        "resource_pages": a.resource_pages,
        "due_at": a.due_at.isoformat() if a.due_at else None,
        "created_at": a.created_at.isoformat(),
        "teacher_name": (a.created_by.full_name or a.created_by.username) if a.created_by else "",
        "submission": submission_payload(s, include_answers=detail),
    }
    reveal = s.status == AssignmentSubmission.Status.GRADED
    if not reveal:
        # Students can still resubmit, so correctness must stay hidden until marked.
        data["submission"]["score_percent"] = None
        data["submission"]["awarded_marks"] = None
        for answer in data["submission"].get("answers", []):
            answer["is_correct"] = None
            answer["awarded_marks"] = None
    if detail:
        data["questions"] = [question_payload(q, reveal=reveal) for q in a.questions.all()]
    return data
