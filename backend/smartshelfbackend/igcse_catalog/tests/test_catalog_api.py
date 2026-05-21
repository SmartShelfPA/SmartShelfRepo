from __future__ import annotations

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from igcse_catalog.models import (
    GenerationStatus,
    IGCSEChapter,
    IGCSEGeneratedSet,
    IGCSESubject,
    PracticePaperAsset,
    SimulatorSet,
    WorkedSolutionsAsset,
)

User = get_user_model()


class IgcseCatalogApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.subject = IGCSESubject.objects.create(
            slug="mathematics",
            title="Mathematics",
            is_published=True,
        )
        self.chapter = IGCSEChapter.objects.create(
            subject=self.subject,
            slug="algebra",
            title="Algebra",
            is_published=True,
        )
        self.generated_set = IGCSEGeneratedSet.objects.create(
            chapter=self.chapter,
            generated_at=timezone.now(),
            is_published=True,
            is_latest_published=True,
            generation_status=GenerationStatus.PUBLISHED,
            quality_score=0.92,
            pipeline_bundle_id="bundle-demo-1",
            version=1,
        )
        PracticePaperAsset.objects.create(
            generated_set=self.generated_set,
            pdf_url="https://cdn.example.com/paper.pdf",
        )
        WorkedSolutionsAsset.objects.create(
            generated_set=self.generated_set,
            pdf_url="https://cdn.example.com/solutions.pdf",
        )
        SimulatorSet.objects.create(
            generated_set=self.generated_set,
            simulator_set_id="sim-algebra-001",
            public_url="https://sim.example.com/algebra",
            artifact_url="https://cdn.example.com/sim.json",
        )

    def test_subjects_envelope(self):
        resp = self.client.get(reverse("igcse-subjects"))
        self.assertEqual(resp.status_code, 200)
        body = resp.json()
        self.assertTrue(body["success"])
        self.assertEqual(body["data"]["provider"], "study_agent")
        ids = [s["id"] for s in body["data"]["subjects"]]
        self.assertIn("mathematics", ids)

    def test_chapters_filter_by_subject(self):
        resp = self.client.get(reverse("igcse-chapters"), {"subject": "mathematics"})
        self.assertEqual(resp.status_code, 200)
        chapters = resp.json()["data"]["chapters"]
        self.assertEqual(len(chapters), 1)
        self.assertEqual(chapters[0]["id"], "algebra")

    def test_sets_list_subject_only_fallback_without_latest_flag(self):
        """When no set is marked latest, subject filter still returns published sets."""
        self.generated_set.is_latest_published = False
        self.generated_set.save(update_fields=["is_latest_published"])

        resp = self.client.get(reverse("igcse-sets-list"), {"subject": "mathematics"})
        self.assertEqual(resp.status_code, 200)
        sets = resp.json()["data"]["sets"]
        self.assertEqual(len(sets), 1)
        self.assertEqual(sets[0]["chapter_slug"], "algebra")

    def test_sets_list_and_detail(self):
        list_resp = self.client.get(
            reverse("igcse-sets-list"),
            {"subject": "mathematics", "chapter": "algebra"},
        )
        self.assertEqual(list_resp.status_code, 200)
        sets = list_resp.json()["data"]["sets"]
        self.assertEqual(len(sets), 1)
        self.assertEqual(sets[0]["simulator_set_id"], "sim-algebra-001")

        detail_resp = self.client.get(
            reverse("igcse-sets-detail", kwargs={"set_id": self.generated_set.id})
        )
        self.assertEqual(detail_resp.status_code, 200)
        detail = detail_resp.json()["data"]["set"]
        self.assertEqual(detail["chapter_slug"], "algebra")
        self.assertEqual(detail["practice_paper"]["url"], "https://cdn.example.com/paper.pdf")

    def test_deprecated_topics_returns_410(self):
        resp = self.client.get(reverse("igcse-topics-deprecated"), {"subject": "mathematics"})
        self.assertEqual(resp.status_code, 410)
        self.assertFalse(resp.json()["success"])
        self.assertEqual(resp["Deprecation"], "true")

    def test_ingest_requires_admin(self):
        admin = User.objects.create_superuser(
            username="adminig",
            email="adminig@example.com",
            password="adminpass123",
        )
        payload = {
            "subject_slug": "physics",
            "chapter_slug": "forces",
            "subject_title": "Physics",
            "chapter_title": "Forces",
            "is_published": True,
            "practice_paper": {"pdf_url": "https://cdn.example.com/p.pdf"},
            "worked_solutions": {"pdf_url": "https://cdn.example.com/s.pdf"},
            "simulator": {
                "simulator_set_id": "sim-forces-1",
                "public_url": "https://sim.example.com/forces",
            },
        }
        anon = self.client.post(reverse("igcse-ingest"), payload, format="json")
        self.assertIn(anon.status_code, (401, 403))

        self.client.force_authenticate(user=admin)
        ok = self.client.post(reverse("igcse-ingest"), payload, format="json")
        self.assertEqual(ok.status_code, 201)
        self.assertTrue(ok.json()["success"])
        self.assertEqual(ok.json()["data"]["set"]["subject_slug"], "physics")
