"""
Set up a beta school with demo and/or real participant accounts.

Examples
--------
Demo accounts (teacher/school admin, 2 students, 2 linked parents, sample work):

    python manage.py setup_beta_school --name "Meadow Hall" --slug meadow-hall --demo

Real participants from the school's list:

    python manage.py setup_beta_school --slug meadow-hall --participants participants.csv \
        --out meadow_hall_credentials.csv

participants.csv columns (header row required):
    role,full_name,email,student_class,child_email,username,is_school_admin
    teacher,Mrs Ada Okafor,ada@meadowhall.ng,,,,yes
    student,Tobi Adeyemi,tobi@meadowhall.ng,SS2A,,,
    parent,Mr Adeyemi,adeyemi@gmail.com,,tobi@meadowhall.ng,,

Passwords are generated per account and printed (or written to --out). Treat
that output as secret and share each login privately with its owner.
"""

from __future__ import annotations

import csv
from datetime import timedelta
from pathlib import Path

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from auth.views import CURRENT_PRIVACY_VERSION, CURRENT_TERMS_VERSION
from classroom.accounts import generate_join_code, generate_temp_password, unique_username
from classroom.models import Assignment, AssignmentQuestion, AssignmentSubmission
from classroom.services import submit_questions
from learning.models import PracticeSession
from users.models import Organization, ParentalConsent, TeacherNote, UserProfile

ROLE_ALIASES = {
    "teacher": UserProfile.Role.STAFF,
    "staff": UserProfile.Role.STAFF,
    "student": UserProfile.Role.STUDENT,
    "parent": UserProfile.Role.PARENT,
}


class Command(BaseCommand):
    help = "Create/update a beta school with demo and/or real participant accounts."

    def add_arguments(self, parser):
        parser.add_argument("--slug", required=True, help="School slug, e.g. meadow-hall")
        parser.add_argument("--name", default="", help="School name (required when creating).")
        parser.add_argument("--join-code", default="", help="Student join code (default: generated).")
        parser.add_argument("--no-join-code", action="store_true", help="Let students join without a code.")
        parser.add_argument("--governs-data", action="store_true", help="School has signed the DPA.")
        parser.add_argument("--demo", action="store_true", help="Create demo teacher/parent/student accounts.")
        parser.add_argument("--participants", default="", help="CSV of real participants to create.")
        parser.add_argument("--password", default="", help="Use this password for demo accounts.")
        parser.add_argument(
            "--reset-passwords", action="store_true", help="Reset passwords of accounts that already exist."
        )
        parser.add_argument("--out", default="", help="Write credentials to this CSV instead of stdout.")

    @transaction.atomic
    def handle(self, *args, **opts):
        org = Organization.objects.filter(slug=opts["slug"]).first()
        if org is None:
            if not opts["name"]:
                raise CommandError("School not found; pass --name to create it.")
            org = Organization.objects.create(name=opts["name"], slug=opts["slug"])
            self.stdout.write(f"Created school {org.name} ({org.slug})")
        elif opts["name"] and org.name != opts["name"]:
            org.name = opts["name"]

        if opts["no_join_code"]:
            org.join_code = ""
        elif opts["join_code"]:
            org.join_code = opts["join_code"].strip().upper()
        elif not org.join_code:
            org.join_code = generate_join_code()
        if opts["governs_data"]:
            org.governs_student_data = True
        org.save()

        self.org = org
        self.reset = opts["reset_passwords"]
        self.credentials: list[dict] = []

        if opts["demo"]:
            self._create_demo(opts["password"])
        if opts["participants"]:
            self._import_participants(Path(opts["participants"]))

        self._report(opts["out"])

    # ── account helpers ──────────────────────────────────────────────────
    def _upsert(self, *, role, full_name, email, username="", student_class="", is_admin=False, password=""):
        user = UserProfile.objects.filter(email__iexact=email).first()
        created = user is None
        if created:
            user = UserProfile.objects.create_user(
                username=unique_username(full_name, username),
                email=email,
                password=None,
                role=role,
                full_name=full_name,
                organization=self.org,
                school_managed=self.org.governs_student_data,
            )
            user.record_policy_acceptance(
                terms_version=CURRENT_TERMS_VERSION, privacy_version=CURRENT_PRIVACY_VERSION, save=False
            )
        elif user.organization_id != self.org.id or user.role != role:
            raise CommandError(
                f"{email} already belongs to another school or role ({user.role}); fix it in admin first."
            )

        user.full_name = full_name
        if role == UserProfile.Role.STUDENT:
            user.student_class = student_class
        if role == UserProfile.Role.STAFF:
            user.staff_role = user.staff_role or "Teacher"
            user.is_school_admin = user.is_school_admin or is_admin

        new_password = ""
        if created or self.reset:
            new_password = password or generate_temp_password()
            user.set_password(new_password)
            user.failed_login_count = 0
            user.locked_until = None
        user.save()

        self.credentials.append(
            {
                "role": "teacher" if role == UserProfile.Role.STAFF else role,
                "full_name": user.full_name,
                "username": user.username,
                "password": new_password or "(unchanged)",
                "email": user.email,
                "class": user.student_class,
                "sign_in_screen": {
                    UserProfile.Role.STAFF: "Teacher Access",
                    UserProfile.Role.PARENT: "Parent Access",
                }.get(role, "Student login"),
            }
        )
        return user

    def _link_parent(self, parent, child):
        parent.managed_students.add(child)
        ParentalConsent.objects.get_or_create(
            minor=child,
            guardian=parent,
            defaults={
                "guardian_name": parent.full_name,
                "guardian_email": parent.email,
                "status": ParentalConsent.ConsentStatus.GRANTED,
                "consent_method": ParentalConsent.ConsentMethod.SCHOOL,
                "granted_at": timezone.now(),
                "notes": "Linked by setup_beta_school.",
            },
        )

    # ── demo ─────────────────────────────────────────────────────────────
    def _create_demo(self, password):
        prefix = self.org.slug.replace("-", "")[:16]
        domain = "demo.smartshelflearn.com"
        teacher = self._upsert(
            role=UserProfile.Role.STAFF,
            full_name=f"Demo Teacher ({self.org.name})",
            email=f"{prefix}.teacher@{domain}",
            username=f"{prefix}_teacher",
            is_admin=True,
            password=password,
        )
        students = []
        for i, name in enumerate(["Demo Student One", "Demo Student Two"], start=1):
            students.append(
                self._upsert(
                    role=UserProfile.Role.STUDENT,
                    full_name=name,
                    email=f"{prefix}.student{i}@{domain}",
                    username=f"{prefix}_student{i}",
                    student_class="SS2A",
                    password=password,
                )
            )
        for i, child in enumerate(students, start=1):
            parent = self._upsert(
                role=UserProfile.Role.PARENT,
                full_name=f"Demo Parent {i}",
                email=f"{prefix}.parent{i}@{domain}",
                username=f"{prefix}_parent{i}",
                password=password,
            )
            self._link_parent(parent, child)

        self._seed_demo_activity(teacher, students)

    def _seed_demo_activity(self, teacher, students):
        now = timezone.now()
        for idx, student in enumerate(students):
            if PracticeSession.objects.filter(user=student).exists():
                continue
            for days_ago, subject, score in ((1, "Mathematics", 70 - idx * 25), (3, "English", 80 - idx * 10)):
                session = PracticeSession.objects.create(
                    organization=self.org,
                    user=student,
                    exam_type="WAEC",
                    subject=subject,
                    year=2022,
                    status=PracticeSession.Status.COMPLETED,
                    score_percent=score,
                    correct_count=score // 10,
                    answered_count=10,
                    duration_seconds=900,
                )
                started = now - timedelta(days=days_ago)
                PracticeSession.objects.filter(pk=session.pk).update(
                    started_at=started, ended_at=started + timedelta(minutes=15)
                )

        if Assignment.objects.filter(organization=self.org, title="Demo: Quadratic equations check").exists():
            return
        assignment = Assignment.objects.create(
            organization=self.org,
            created_by=teacher,
            title="Demo: Quadratic equations check",
            instructions="Answer all three questions. Show your working for question 3.",
            kind=Assignment.Kind.QUESTIONS,
            target_class="SS2A",
            due_at=now + timedelta(days=5),
        )
        q1 = AssignmentQuestion.objects.create(
            assignment=assignment, order=0, kind=AssignmentQuestion.Kind.MULTIPLE_CHOICE,
            prompt="What are the roots of x² - 5x + 6 = 0?",
            options=[{"id": "A", "label": "2 and 3"}, {"id": "B", "label": "-2 and -3"},
                     {"id": "C", "label": "1 and 6"}, {"id": "D", "label": "-1 and 6"}],
            correct_option_id="A", max_marks=1,
        )
        q2 = AssignmentQuestion.objects.create(
            assignment=assignment, order=1, kind=AssignmentQuestion.Kind.MULTIPLE_CHOICE,
            prompt="The discriminant of ax² + bx + c is…",
            options=[{"id": "A", "label": "b² + 4ac"}, {"id": "B", "label": "b² - 4ac"},
                     {"id": "C", "label": "4ac - b²"}, {"id": "D", "label": "2a"}],
            correct_option_id="B", max_marks=1,
        )
        q3 = AssignmentQuestion.objects.create(
            assignment=assignment, order=2, kind=AssignmentQuestion.Kind.THEORY,
            prompt="Solve 2x² + 3x - 2 = 0 using the quadratic formula. Show every step.",
            marking_guide="x = [-3 ± √(9 + 16)] / 4 = (-3 ± 5) / 4, so x = 1/2 or x = -2. "
            "1 mark formula, 1 mark substitution, 1 mark each root.",
            max_marks=4,
        )
        AssignmentSubmission.objects.bulk_create(
            [AssignmentSubmission(assignment=assignment, student=s) for s in students]
        )
        first = AssignmentSubmission.objects.get(assignment=assignment, student=students[0])
        submit_questions(
            first,
            [
                {"question_id": str(q1.id), "selected_option_id": "A"},
                {"question_id": str(q2.id), "selected_option_id": "B"},
                {"question_id": str(q3.id), "text_answer": "a=2, b=3, c=-2. x = (-3 ± √25)/4 so x = 1/2 or x = -2"},
            ],
        )
        TeacherNote.objects.get_or_create(
            teacher=teacher,
            student=students[1],
            note="Good effort in class this week. Please encourage 20 minutes of maths practice daily.",
            defaults={"shared_with_parent": True},
        )

    # ── participants CSV ─────────────────────────────────────────────────
    def _import_participants(self, path: Path):
        if not path.is_file():
            raise CommandError(f"Participants file not found: {path}")
        with path.open(newline="", encoding="utf-8-sig") as fh:
            rows = [{(k or "").strip().lower(): (v or "").strip() for k, v in r.items()} for r in csv.DictReader(fh)]

        by_email: dict[str, UserProfile] = {}
        parents = []
        for line, row in enumerate(rows, start=2):
            role = ROLE_ALIASES.get(row.get("role", "").lower())
            if role is None:
                raise CommandError(f"Line {line}: role must be teacher, student or parent.")
            if not row.get("full_name") or not row.get("email"):
                raise CommandError(f"Line {line}: full_name and email are required.")
            if role == UserProfile.Role.STUDENT and not row.get("student_class"):
                raise CommandError(f"Line {line}: students need a student_class.")
            if role == UserProfile.Role.PARENT:
                parents.append((line, row))
                continue
            user = self._upsert(
                role=role,
                full_name=row["full_name"],
                email=row["email"],
                username=row.get("username", ""),
                student_class=row.get("student_class", ""),
                is_admin=row.get("is_school_admin", "").lower() in ("yes", "y", "true", "1"),
            )
            by_email[user.email.lower()] = user

        for line, row in parents:
            child_emails = [e.strip().lower() for e in row.get("child_email", "").split(";") if e.strip()]
            if not child_emails:
                raise CommandError(f"Line {line}: parents need child_email (use ; for several).")
            children = []
            for email in child_emails:
                child = by_email.get(email) or UserProfile.objects.filter(
                    email__iexact=email, organization=self.org, role=UserProfile.Role.STUDENT
                ).first()
                if child is None:
                    raise CommandError(f"Line {line}: no student with email {email} in this school.")
                children.append(child)
            parent = self._upsert(
                role=UserProfile.Role.PARENT,
                full_name=row["full_name"],
                email=row["email"],
                username=row.get("username", ""),
            )
            for child in children:
                self._link_parent(parent, child)

    # ── output ───────────────────────────────────────────────────────────
    def _report(self, out_path: str):
        self.stdout.write(self.style.SUCCESS(f"\nSchool: {self.org.name} ({self.org.slug})"))
        if self.org.join_code:
            self.stdout.write(f"Student join code: {self.org.join_code}")
        else:
            self.stdout.write("Student join code: (none - any student can pick this school)")
        if not self.credentials:
            return
        fields = ["role", "full_name", "username", "password", "email", "class", "sign_in_screen"]
        if out_path:
            with open(out_path, "w", newline="", encoding="utf-8") as fh:
                writer = csv.DictWriter(fh, fieldnames=fields)
                writer.writeheader()
                writer.writerows(self.credentials)
            self.stdout.write(
                self.style.WARNING(f"Credentials written to {out_path}. Keep this file private.")
            )
            return
        self.stdout.write(self.style.WARNING("\nCredentials (share privately with each person):"))
        for c in self.credentials:
            self.stdout.write(
                f"  {c['role']:<8} {c['full_name']:<32} username={c['username']:<24} "
                f"password={c['password']:<16} -> {c['sign_in_screen']}"
            )
