import django.db.models.deletion
import uuid
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("classroom", "0002_parent_teacher_messages"),
        ("learning", "0005_school_resources_pdf_annotations"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(
            model_name="assignmentquestion",
            name="review_label",
            field=models.CharField(
                blank=True,
                help_text="Textbook section to reopen after a wrong answer, e.g. 'Section 3.2'.",
                max_length=200,
            ),
        ),
        migrations.AddField(
            model_name="assignmentquestion",
            name="review_page",
            field=models.PositiveIntegerField(blank=True, null=True),
        ),
        migrations.CreateModel(
            name="TextbookLicence",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("target_class", models.CharField(blank=True, help_text="Blank = every class in the school that can already see the book.", max_length=120)),
                ("term_label", models.CharField(help_text="e.g. 2026/27 Term 1", max_length=80)),
                ("starts_on", models.DateField()),
                ("ends_on", models.DateField()),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("asset", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="textbook_licences", to="learning.protectedpdfasset")),
                ("organization", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="textbook_licences", to="users.organization")),
            ],
            options={"ordering": ["-starts_on", "term_label"]},
        ),
        migrations.CreateModel(
            name="TextbookTopic",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("title", models.CharField(max_length=200)),
                ("chapter_label", models.CharField(blank=True, max_length=120)),
                ("page_start", models.PositiveIntegerField(blank=True, null=True)),
                ("page_end", models.PositiveIntegerField(blank=True, null=True)),
                ("order", models.PositiveSmallIntegerField(default=0)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("asset", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="topics", to="learning.protectedpdfasset")),
                ("created_by", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="textbook_topics_created", to=settings.AUTH_USER_MODEL)),
                ("organization", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="textbook_topics", to="users.organization")),
            ],
            options={"ordering": ["order", "title"]},
        ),
        migrations.CreateModel(
            name="TopicQuestion",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("order", models.PositiveSmallIntegerField(default=0)),
                ("prompt", models.TextField()),
                ("options", models.JSONField(blank=True, default=list)),
                ("correct_option_id", models.CharField(max_length=16)),
                ("explanation", models.TextField(blank=True)),
                ("review_label", models.CharField(blank=True, max_length=200)),
                ("review_page", models.PositiveIntegerField(blank=True, null=True)),
                ("topic", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="questions", to="classroom.textbooktopic")),
            ],
            options={"ordering": ["order"]},
        ),
        migrations.CreateModel(
            name="TopicAttempt",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("score_percent", models.FloatField(default=0)),
                ("correct_count", models.PositiveSmallIntegerField(default=0)),
                ("total_count", models.PositiveSmallIntegerField(default=0)),
                ("completed_at", models.DateTimeField(auto_now_add=True)),
                ("student", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="topic_attempts", to=settings.AUTH_USER_MODEL)),
                ("topic", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="attempts", to="classroom.textbooktopic")),
            ],
            options={"ordering": ["-completed_at"]},
        ),
        migrations.CreateModel(
            name="TopicAnswer",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("selected_option_id", models.CharField(blank=True, max_length=16)),
                ("is_correct", models.BooleanField(default=False)),
                ("attempt", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="answers", to="classroom.topicattempt")),
                ("question", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="answers", to="classroom.topicquestion")),
            ],
            options={"ordering": ["question__order"]},
        ),
        migrations.CreateModel(
            name="RevisionCard",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("page", models.PositiveIntegerField(default=1)),
                ("front", models.TextField(help_text="Passage or prompt saved from the page.")),
                ("back", models.TextField(help_text="The student's own note or answer.")),
                ("box", models.PositiveSmallIntegerField(default=0, help_text="0, 1, or 2 — how well it is known.")),
                ("next_review_at", models.DateTimeField()),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("asset", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="revision_cards", to="learning.protectedpdfasset")),
                ("user", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="revision_cards", to=settings.AUTH_USER_MODEL)),
            ],
            options={"ordering": ["next_review_at", "-updated_at"]},
        ),
        migrations.CreateModel(
            name="PdfReadingState",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("page", models.PositiveIntegerField(default=1)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("asset", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="reading_states", to="learning.protectedpdfasset")),
                ("user", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="pdf_reading_states", to=settings.AUTH_USER_MODEL)),
            ],
        ),
        migrations.AddConstraint(
            model_name="pdfreadingstate",
            constraint=models.UniqueConstraint(fields=("user", "asset"), name="classroom_unique_pdf_reading"),
        ),
    ]
