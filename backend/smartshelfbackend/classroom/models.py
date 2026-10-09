import uuid

from django.conf import settings
from django.db import models

from learning.models import PracticeSession, ProtectedPdfAsset
from users.models import Organization


class Assignment(models.Model):
    """Work a teacher sets for a class or for selected students."""

    class Kind(models.TextChoices):
        PRACTICE = "practice", "Past-question practice (WAEC/JAMB)"
        READING = "reading", "Reading"
        QUESTIONS = "questions", "Teacher-written questions"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        Organization, on_delete=models.CASCADE, related_name="assignments"
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="assignments_created",
    )
    title = models.CharField(max_length=200)
    instructions = models.TextField(blank=True)
    kind = models.CharField(max_length=16, choices=Kind.choices)
    target_class = models.CharField(
        max_length=120, blank=True, help_text="Class the assignment was set for, if any."
    )
    students = models.ManyToManyField(
        settings.AUTH_USER_MODEL,
        through="AssignmentSubmission",
        through_fields=("assignment", "student"),
        related_name="assignments_received",
    )

    # Practice assignments
    exam_type = models.CharField(max_length=10, blank=True)
    subject = models.CharField(max_length=120, blank=True)
    year = models.PositiveIntegerField(null=True, blank=True)
    question_count = models.PositiveSmallIntegerField(default=10)

    # Reading assignments
    resource = models.ForeignKey(
        ProtectedPdfAsset,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="assignments",
    )
    resource_pages = models.CharField(
        max_length=120, blank=True, help_text="e.g. 'Chapter 3, pages 40-52'."
    )

    due_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return self.title

    @property
    def max_marks(self) -> float:
        return float(sum(q.max_marks for q in self.questions.all()))


class AssignmentQuestion(models.Model):
    class Kind(models.TextChoices):
        MULTIPLE_CHOICE = "mcq", "Multiple choice"
        SHORT_ANSWER = "short", "Short answer"
        THEORY = "theory", "Theory / worked solution"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    assignment = models.ForeignKey(Assignment, on_delete=models.CASCADE, related_name="questions")
    order = models.PositiveSmallIntegerField(default=0)
    kind = models.CharField(max_length=10, choices=Kind.choices)
    prompt = models.TextField()
    options = models.JSONField(
        default=list, blank=True, help_text="Multiple choice only: [{'id': 'A', 'label': '...'}]."
    )
    correct_option_id = models.CharField(max_length=16, blank=True)
    marking_guide = models.TextField(
        blank=True, help_text="Model answer / marking scheme. Shown to students after grading."
    )
    max_marks = models.PositiveSmallIntegerField(default=1)

    class Meta:
        ordering = ["order"]

    def __str__(self) -> str:
        return f"Q{self.order + 1}: {self.prompt[:40]}"


class AssignmentSubmission(models.Model):
    """One row per student an assignment was set for; doubles as the recipient list."""

    class Status(models.TextChoices):
        ASSIGNED = "assigned", "Not started"
        SUBMITTED = "submitted", "Submitted, awaiting marking"
        GRADED = "graded", "Marked"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    assignment = models.ForeignKey(Assignment, on_delete=models.CASCADE, related_name="submissions")
    student = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="assignment_submissions"
    )
    status = models.CharField(max_length=12, choices=Status.choices, default=Status.ASSIGNED)
    practice_session = models.ForeignKey(
        PracticeSession, on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    response_text = models.TextField(
        blank=True, help_text="Reading assignments: the student's summary or reflection."
    )
    awarded_marks = models.FloatField(null=True, blank=True)
    score_percent = models.FloatField(null=True, blank=True)
    teacher_feedback = models.TextField(blank=True)
    submitted_at = models.DateTimeField(null=True, blank=True)
    graded_at = models.DateTimeField(null=True, blank=True)
    graded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="+",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["assignment", "student__full_name"]
        constraints = [
            models.UniqueConstraint(
                fields=["assignment", "student"], name="classroom_unique_submission"
            )
        ]

    def __str__(self) -> str:
        return f"{self.student} · {self.assignment}"


class AssignmentAnswer(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    submission = models.ForeignKey(
        AssignmentSubmission, on_delete=models.CASCADE, related_name="answers"
    )
    question = models.ForeignKey(AssignmentQuestion, on_delete=models.CASCADE, related_name="answers")
    selected_option_id = models.CharField(max_length=16, blank=True)
    text_answer = models.TextField(blank=True)
    is_correct = models.BooleanField(null=True, blank=True)
    awarded_marks = models.FloatField(null=True, blank=True)
    feedback = models.TextField(blank=True)

    class Meta:
        ordering = ["question__order"]
        constraints = [
            models.UniqueConstraint(fields=["submission", "question"], name="classroom_unique_answer")
        ]


class MessageThread(models.Model):
    """A private conversation between one parent and one teacher about one child."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        Organization, on_delete=models.CASCADE, related_name="message_threads"
    )
    parent = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="parent_threads"
    )
    teacher = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="teacher_threads"
    )
    student = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="+"
    )
    last_message_at = models.DateTimeField(null=True, blank=True)
    parent_last_read_at = models.DateTimeField(null=True, blank=True)
    teacher_last_read_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-last_message_at", "-created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["parent", "teacher", "student"], name="classroom_unique_message_thread"
            )
        ]

    def __str__(self) -> str:
        return f"{self.parent} ↔ {self.teacher} ({self.student})"


class Message(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    thread = models.ForeignKey(MessageThread, on_delete=models.CASCADE, related_name="messages")
    sender = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name="+"
    )
    body = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at"]

    def __str__(self) -> str:
        return self.body[:40]
