import io

from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.management import call_command
from django.test import TestCase, override_settings
from rest_framework.authtoken.models import Token
from rest_framework.test import APIClient

from learning.models import PdfAnnotation, PracticeSession, StoredFile
from users.models import Organization, TeacherNote, UserProfile

from .models import Assignment, AssignmentSubmission

PDF_BYTES = b"%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF"


def make_user(username, role, org, **extra):
    user = UserProfile.objects.create_user(
        username=username,
        password="Passw0rd!x",
        email=f"{username}@example.com",
        role=role,
        full_name=username.title(),
        organization=org,
        **extra,
    )
    return user


def client_for(user):
    client = APIClient()
    token, _ = Token.objects.get_or_create(user=user)
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {token.key}")
    return client


class BaseSchoolTest(TestCase):
    def setUp(self):
        self.org = Organization.objects.create(name="Meadow Hall", slug="meadow-hall")
        self.other_org = Organization.objects.create(name="Other School", slug="other-school")
        self.teacher = make_user("teacher", UserProfile.Role.STAFF, self.org, is_school_admin=True)
        self.student = make_user("student1", UserProfile.Role.STUDENT, self.org, student_class="SS2A")
        self.student2 = make_user("student2", UserProfile.Role.STUDENT, self.org, student_class="SS2B")
        self.parent = make_user("parent1", UserProfile.Role.PARENT, self.org)
        self.parent.managed_students.add(self.student)
        self.outsider = make_user("outsider", UserProfile.Role.STUDENT, self.other_org, student_class="SS2A")


class AccountSeparationTests(BaseSchoolTest):
    def test_public_signup_cannot_create_teacher(self):
        res = APIClient().post(
            "/api/v1/auth/register/",
            {
                "username": "fake_teacher", "password": "Passw0rd!x", "email": "fake@example.com",
                "role": "staff", "full_name": "Fake", "organization_slug": "meadow-hall",
                "staff_role": "Teacher", "staff_department": "Maths", "terms_accepted": True,
            },
            format="json",
        )
        self.assertEqual(res.status_code, 400)
        self.assertFalse(UserProfile.objects.filter(username="fake_teacher").exists())

    def test_join_code_required_when_school_sets_one(self):
        self.org.join_code = "MH2026"
        self.org.save()
        payload = {
            "username": "newkid", "password": "Passw0rd!x", "email": "newkid@example.com",
            "role": "student", "full_name": "New Kid", "organization_slug": "meadow-hall",
            "student_class": "SS1", "terms_accepted": True,
        }
        res = APIClient().post("/api/v1/auth/register/", payload, format="json")
        self.assertEqual(res.status_code, 400)
        self.assertEqual(res.json()["code"], "school_code_required")
        res = APIClient().post("/api/v1/auth/register/", {**payload, "school_code": "mh2026"}, format="json")
        self.assertEqual(res.status_code, 201)

    def test_student_cannot_sign_in_through_parent_portal(self):
        res = APIClient().post(
            "/api/v1/auth/login/",
            {"username": "student1", "password": "Passw0rd!x", "portal": "parent"},
            format="json",
        )
        self.assertEqual(res.status_code, 403)
        self.assertEqual(res.json()["error"], "wrong_portal")
        self.assertNotIn("token", res.json())

    def test_parent_portal_login_works_for_parent(self):
        res = APIClient().post(
            "/api/v1/auth/login/",
            {"username": "parent1", "password": "Passw0rd!x", "portal": "parent"},
            format="json",
        )
        self.assertEqual(res.status_code, 200)
        self.assertIn("token", res.json())

    def test_student_token_cannot_read_parent_dashboard(self):
        res = client_for(self.student).get("/api/v1/parent/dashboard/")
        self.assertEqual(res.status_code, 403)

    def test_parent_dashboard_only_shows_linked_children(self):
        TeacherNote.objects.create(
            teacher=self.teacher, student=self.student, note="Shared note", shared_with_parent=True
        )
        TeacherNote.objects.create(
            teacher=self.teacher, student=self.student, note="Private note", shared_with_parent=False
        )
        data = client_for(self.parent).get("/api/v1/parent/dashboard/").json()
        self.assertEqual([c["id"] for c in data["children"]], [str(self.student.id)])
        notes = [n["note"] for n in data["children"][0]["teacherNotes"]]
        self.assertEqual(notes, ["Shared note"])

    def test_teacher_bookshelf_limited_to_own_school(self):
        res = client_for(self.teacher).get("/api/v1/bookshelf/")
        self.assertEqual(res.status_code, 200)
        publisher = make_user("pub", UserProfile.Role.PUBLISHER, None)
        self.assertEqual(client_for(publisher).get("/api/v1/bookshelf/").json(), [])


class AssignmentFlowTests(BaseSchoolTest):
    def _create_questions_assignment(self):
        res = client_for(self.teacher).post(
            "/api/v1/staff/assignments/",
            {
                "title": "Algebra check",
                "kind": "questions",
                "target_class": "SS2A",
                "questions": [
                    {"kind": "mcq", "prompt": "2+2?", "options": [{"label": "3"}, {"label": "4"}],
                     "correct_option_id": "B", "max_marks": 1},
                    {"kind": "theory", "prompt": "Prove it.", "marking_guide": "Counting", "max_marks": 3},
                ],
            },
            format="json",
        )
        self.assertEqual(res.status_code, 201, res.content)
        return res.json()

    def test_full_questions_flow(self):
        created = self._create_questions_assignment()
        self.assertEqual(created["total_students"], 1)  # only SS2A

        student_client = client_for(self.student)
        listed = student_client.get("/api/v1/student/assignments/").json()
        self.assertEqual(len(listed), 1)
        detail = student_client.get(f"/api/v1/student/assignments/{created['id']}/").json()
        self.assertNotIn("correct_option_id", detail["questions"][0])
        q1, q2 = detail["questions"]

        res = student_client.post(
            f"/api/v1/student/assignments/{created['id']}/submit/",
            {"answers": [
                {"question_id": q1["id"], "selected_option_id": "B"},
                {"question_id": q2["id"], "text_answer": "1+1+1+1"},
            ]},
            format="json",
        )
        self.assertEqual(res.status_code, 200, res.content)
        self.assertEqual(res.json()["submission"]["status"], "submitted")

        # Until marked, the student can't learn which MCQ answers were right (they could resubmit).
        pending = student_client.get(f"/api/v1/student/assignments/{created['id']}/").json()
        self.assertIsNone(pending["submission"]["score_percent"])
        self.assertTrue(all(a["is_correct"] is None for a in pending["submission"]["answers"]))
        self.assertNotIn("marking_guide", pending["questions"][1])

        # Other students in the same school can't see it; neither can other schools.
        self.assertEqual(client_for(self.student2).get("/api/v1/student/assignments/").json(), [])
        self.assertEqual(
            client_for(self.outsider).get(f"/api/v1/student/assignments/{created['id']}/").status_code, 404
        )

        submission = AssignmentSubmission.objects.get(student=self.student)
        teacher_view = client_for(self.teacher).get(f"/api/v1/staff/submissions/{submission.id}/").json()
        theory_answer = next(a for a in teacher_view["answers"] if a["question_id"] == q2["id"])
        res = client_for(self.teacher).patch(
            f"/api/v1/staff/submissions/{submission.id}/",
            {"answers": [{"answer_id": theory_answer["id"], "awarded_marks": 2, "feedback": "Nearly"}],
             "teacher_feedback": "Good work"},
            format="json",
        )
        self.assertEqual(res.status_code, 200, res.content)
        self.assertEqual(res.json()["status"], "graded")
        self.assertEqual(res.json()["score_percent"], 75.0)

        # Parent sees the marked assignment and feedback.
        parent_data = client_for(self.parent).get("/api/v1/parent/dashboard/").json()
        a = parent_data["children"][0]["assignments"][0]
        self.assertEqual((a["status"], a["scorePercent"], a["teacherFeedback"]), ("graded", 75.0, "Good work"))

        # Student now sees the marking guide.
        detail = student_client.get(f"/api/v1/student/assignments/{created['id']}/").json()
        self.assertEqual(detail["questions"][1]["marking_guide"], "Counting")

        export = client_for(self.teacher).get(f"/api/v1/staff/assignments/{created['id']}/export/")
        self.assertEqual(export.status_code, 200)
        self.assertIn(b"student1", export.content)

    def test_mcq_only_is_marked_automatically(self):
        res = client_for(self.teacher).post(
            "/api/v1/staff/assignments/",
            {"title": "Quick quiz", "kind": "questions", "student_ids": [str(self.student.id)],
             "questions": [{"kind": "mcq", "prompt": "1+1?", "options": [{"label": "2"}, {"label": "3"}],
                            "correct_option_id": "A"}]},
            format="json",
        ).json()
        q = client_for(self.student).get(f"/api/v1/student/assignments/{res['id']}/").json()["questions"][0]
        out = client_for(self.student).post(
            f"/api/v1/student/assignments/{res['id']}/submit/",
            {"answers": [{"question_id": q["id"], "selected_option_id": "A"}]},
            format="json",
        ).json()
        self.assertEqual(out["submission"]["status"], "graded")
        self.assertEqual(out["submission"]["score_percent"], 100.0)

    def test_practice_assignment_uses_completed_session(self):
        res = client_for(self.teacher).post(
            "/api/v1/staff/assignments/",
            {"title": "WAEC Maths 2022", "kind": "practice", "target_class": "SS2A",
             "exam_type": "WAEC", "subject": "Mathematics", "year": 2022},
            format="json",
        ).json()
        session = PracticeSession.objects.create(
            organization=self.org, user=self.student, exam_type="WAEC", subject="Mathematics",
            status=PracticeSession.Status.COMPLETED, score_percent=60, correct_count=6, answered_count=10,
        )
        out = client_for(self.student).post(
            f"/api/v1/student/assignments/{res['id']}/submit/",
            {"practice_session_id": str(session.id)},
            format="json",
        )
        self.assertEqual(out.status_code, 200, out.content)
        self.assertEqual(out.json()["submission"]["score_percent"], 60.0)

    def test_teacher_cannot_target_other_school_students(self):
        res = client_for(self.teacher).post(
            "/api/v1/staff/assignments/",
            {"title": "Sneaky", "kind": "reading", "instructions": "Read ch 1",
             "student_ids": [str(self.outsider.id)]},
            format="json",
        )
        self.assertEqual(res.status_code, 400)
        self.assertFalse(Assignment.objects.exists())

    def test_student_cannot_use_teacher_endpoints(self):
        self.assertEqual(client_for(self.student).get("/api/v1/staff/assignments/").status_code, 403)


class SchoolResourceTests(BaseSchoolTest):
    def _upload(self, classes=""):
        return client_for(self.teacher).post(
            "/api/v1/school/resources/",
            {"title": "SS2 Physics notes", "subject": "Physics", "audience_classes": classes,
             "rights_confirmed": "true",
             "file": SimpleUploadedFile("notes.pdf", PDF_BYTES, content_type="application/pdf")},
            format="multipart",
        )

    def test_upload_is_segregated_by_school_and_class(self):
        res = self._upload("SS2A")
        self.assertEqual(res.status_code, 201, res.content)
        asset_id = res.json()["id"]

        def visible(user):
            return [r["id"] for r in client_for(user).get("/api/v1/igcse/pdfs/").json()]

        self.assertIn(asset_id, visible(self.student))
        self.assertNotIn(asset_id, visible(self.student2))  # different class
        self.assertNotIn(asset_id, visible(self.outsider))  # different school
        denied = client_for(self.outsider).post(f"/api/v1/igcse/pdfs/{asset_id}/authorize-download/")
        self.assertEqual(denied.status_code, 403)
        allowed = client_for(self.student).post(f"/api/v1/igcse/pdfs/{asset_id}/authorize-download/")
        self.assertEqual(allowed.status_code, 200)

    @override_settings(PROTECTED_STORAGE_BACKEND="database")
    def test_database_storage_round_trip(self):
        asset_id = self._upload().json()["id"]
        self.assertTrue(StoredFile.objects.exists())
        auth = client_for(self.student).post(f"/api/v1/igcse/pdfs/{asset_id}/authorize-download/").json()
        path = auth["download_url"].split("testserver", 1)[1]
        res = APIClient().get(path)
        self.assertEqual(res.status_code, 200)
        self.assertEqual(b"".join(res.streaming_content), PDF_BYTES)

    def test_non_pdf_and_unconfirmed_rights_rejected(self):
        res = client_for(self.teacher).post(
            "/api/v1/school/resources/",
            {"title": "Bad", "rights_confirmed": "true",
             "file": SimpleUploadedFile("x.pdf", b"hello", content_type="application/pdf")},
            format="multipart",
        )
        self.assertEqual(res.status_code, 400)
        res = client_for(self.teacher).post(
            "/api/v1/school/resources/",
            {"title": "No rights", "file": SimpleUploadedFile("x.pdf", PDF_BYTES)},
            format="multipart",
        )
        self.assertEqual(res.status_code, 400)

    def test_students_cannot_upload(self):
        res = client_for(self.student).post(
            "/api/v1/school/resources/",
            {"title": "x", "rights_confirmed": "true", "file": SimpleUploadedFile("x.pdf", PDF_BYTES)},
            format="multipart",
        )
        self.assertEqual(res.status_code, 403)

    def test_annotations_are_private_and_access_checked(self):
        asset_id = self._upload().json()["id"]
        stroke = {"page": 1, "kind": "highlight", "color": "#FFEB3B", "points": [[0.1, 0.2], [0.4, 0.2]]}
        res = client_for(self.student).post(f"/api/v1/igcse/pdfs/{asset_id}/annotations/", stroke, format="json")
        self.assertEqual(res.status_code, 201, res.content)
        self.assertEqual(len(client_for(self.student).get(f"/api/v1/igcse/pdfs/{asset_id}/annotations/").json()), 1)
        self.assertEqual(client_for(self.student2).get(f"/api/v1/igcse/pdfs/{asset_id}/annotations/").json(), [])
        self.assertEqual(
            client_for(self.outsider).get(f"/api/v1/igcse/pdfs/{asset_id}/annotations/").status_code, 403
        )
        ann_id = res.json()["id"]
        self.assertEqual(
            client_for(self.student2).delete(f"/api/v1/igcse/pdfs/{asset_id}/annotations/{ann_id}/").status_code,
            404,
        )
        self.assertEqual(PdfAnnotation.objects.count(), 1)


class SchoolAdminTests(BaseSchoolTest):
    def test_admin_creates_student_and_resets_password(self):
        client = client_for(self.teacher)
        res = client.post(
            "/api/v1/school/members/",
            {"role": "student", "full_name": "Tobi Adeyemi", "email": "tobi@example.com", "student_class": "SS2A"},
            format="json",
        )
        self.assertEqual(res.status_code, 201, res.content)
        body = res.json()
        login = APIClient().post(
            "/api/v1/auth/login/",
            {"username": body["username"], "password": body["temporary_password"], "portal": "student"},
            format="json",
        )
        self.assertEqual(login.status_code, 200)
        reset = client.post(f"/api/v1/school/members/{body['id']}/reset-password/").json()
        self.assertNotEqual(reset["temporary_password"], body["temporary_password"])

    def test_regular_teacher_is_not_school_admin(self):
        plain = make_user("plainteacher", UserProfile.Role.STAFF, self.org)
        self.assertEqual(client_for(plain).get("/api/v1/school/members/").status_code, 403)
        self.assertNotIn("join_code", client_for(plain).get("/api/v1/school/").json())


class FeedbackTests(BaseSchoolTest):
    def test_submit_feedback(self):
        res = client_for(self.parent).post(
            "/api/v1/support/feedback/",
            {"category": "idea", "message": "Please add weekly email summaries", "rating": 4, "screen": "parent"},
            format="json",
        )
        self.assertEqual(res.status_code, 201, res.content)
        from support.models import Feedback

        fb = Feedback.objects.get()
        self.assertEqual((fb.role, fb.organization_id), ("parent", self.org.id))
        self.assertEqual(APIClient().get("/api/v1/support/info/").status_code, 200)


class SetupBetaSchoolCommandTests(TestCase):
    def test_demo_setup_is_idempotent(self):
        out = io.StringIO()
        call_command("setup_beta_school", "--slug", "meadow-hall", "--name", "Meadow Hall", "--demo", stdout=out)
        call_command("setup_beta_school", "--slug", "meadow-hall", "--demo", stdout=io.StringIO())
        org = Organization.objects.get(slug="meadow-hall")
        self.assertTrue(org.join_code)
        self.assertEqual(UserProfile.objects.filter(organization=org).count(), 5)
        parent = UserProfile.objects.get(username="meadowhall_parent1")
        self.assertEqual(parent.managed_students.count(), 1)
        self.assertEqual(Assignment.objects.filter(organization=org).count(), 1)
        self.assertIn("password=", out.getvalue())
