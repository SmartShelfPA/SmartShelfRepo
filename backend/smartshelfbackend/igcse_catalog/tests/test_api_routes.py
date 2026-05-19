from __future__ import annotations

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


class IgcseCatalogRouteTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.subject = IGCSESubject.objects.create(
            slug="biology",
            title="Biology",
            is_published=True,
        )
        self.chapter = IGCSEChapter.objects.create(
            subject=self.subject,
            slug="cell_biology",
            title="Cell Biology",
            is_published=True,
        )
        self.generated_set = IGCSEGeneratedSet.objects.create(
            chapter=self.chapter,
            generated_at=timezone.now(),
            is_published=True,
            is_latest_published=True,
            generation_status=GenerationStatus.PUBLISHED,
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
            simulator_set_id="sim-cells",
            public_url="https://sim.example.com/cells",
        )

    def test_subjects_study_agent_provider(self):
        resp = self.client.get(reverse("igcse-subjects"))
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()["data"]["provider"], "study_agent")

    def test_deprecated_topics_returns_410(self):
        resp = self.client.get(
            reverse("igcse-topics-deprecated"),
            {"subject": "biology"},
        )
        self.assertEqual(resp.status_code, 410)
        self.assertEqual(resp["Deprecation"], "true")

    def test_deprecated_questions_returns_410(self):
        resp = self.client.get(
            reverse("igcse-questions-deprecated"),
            {"subject": "biology", "topic": "cell_biology"},
        )
        self.assertEqual(resp.status_code, 410)

    def test_deprecated_search_returns_410(self):
        resp = self.client.get(reverse("igcse-search-deprecated"), {"q": "cell"})
        self.assertEqual(resp.status_code, 410)
