from __future__ import annotations

import json
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from django.urls import reverse
from django.utils import timezone

from igcse_catalog.models import GenerationStatus, IGCSEChapter, IGCSEGeneratedSet, IGCSESubject
from igcse_catalog.publishing import publish_generated_set, unpublish_generated_set
from igcse_catalog.services.ingestion import ingest_generated_set

User = get_user_model()


class PublishingServiceTests(TestCase):
    def setUp(self):
        self.subject = IGCSESubject.objects.create(slug="physics", title="Physics")
        self.chapter = IGCSEChapter.objects.create(
            subject=self.subject,
            slug="waves",
            title="Waves",
        )
        self.generated_set = IGCSEGeneratedSet.objects.create(
            chapter=self.chapter,
            generated_at=timezone.now(),
            version=1,
            generation_status=GenerationStatus.READY,
        )

    def test_publish_cascades_parents_and_marks_latest(self):
        publish_generated_set(self.generated_set)
        self.subject.refresh_from_db()
        self.chapter.refresh_from_db()
        self.generated_set.refresh_from_db()
        self.assertTrue(self.subject.is_published)
        self.assertTrue(self.chapter.is_published)
        self.assertTrue(self.generated_set.is_published)
        self.assertTrue(self.generated_set.is_latest_published)
        self.assertEqual(self.generated_set.generation_status, GenerationStatus.PUBLISHED)

    def test_unpublish_clears_latest_flag(self):
        publish_generated_set(self.generated_set)
        unpublish_generated_set(self.generated_set)
        self.generated_set.refresh_from_db()
        self.assertFalse(self.generated_set.is_published)
        self.assertFalse(self.generated_set.is_latest_published)


class AdminPublishWorkflowTests(TestCase):
    def setUp(self):
        self.staff = User.objects.create_superuser(
            username="admin",
            email="admin@test.com",
            password="testpass123",
        )
        self.client.force_login(self.staff)
        result = ingest_generated_set(
            {
                "subject_slug": "maths",
                "chapter_slug": "algebra",
                "pipeline_bundle_id": "math-alg-v1",
                "practice_paper": {"pdf_url": "https://cdn.example.com/p.pdf"},
                "worked_solutions": {"pdf_url": "https://cdn.example.com/s.pdf"},
                "simulator": {
                    "simulator_set_id": "sim-alg",
                    "public_url": "https://sim.example.com/alg",
                },
            }
        )
        self.generated_set = result.generated_set

    def test_changelist_import_link(self):
        url = reverse("admin:igcse_catalog_igcsegeneratedset_changelist")
        response = self.client.get(url)
        self.assertEqual(response.status_code, 200)
        import_url = reverse("admin:igcse_catalog_igcsegeneratedset_import_manifest")
        self.assertContains(response, import_url)

    def test_import_manifest_view(self):
        manifest = {
            "subject_slug": "maths",
            "chapter_slug": "geometry",
            "pipeline_bundle_id": "math-geo-v1",
            "practice_paper": {"pdf_url": "https://cdn.example.com/g.pdf"},
            "worked_solutions": {"pdf_url": "https://cdn.example.com/gs.pdf"},
            "simulator": {
                "simulator_set_id": "sim-geo",
                "public_url": "https://sim.example.com/geo",
            },
        }
        url = reverse("admin:igcse_catalog_igcsegeneratedset_import_manifest")
        response = self.client.post(
            url,
            {
                "manifest_file": SimpleUploadedFile(
                    "manifest.json",
                    json.dumps(manifest).encode("utf-8"),
                    content_type="application/json",
                ),
                "publish_after_ingest": "on",
            },
        )
        self.assertEqual(response.status_code, 302)
        geo = IGCSEGeneratedSet.objects.get(chapter__slug="geometry")
        self.assertTrue(geo.is_published)
        self.assertTrue(geo.is_latest_published)

    def test_publish_action(self):
        self.generated_set.is_published = False
        self.generated_set.is_latest_published = False
        self.generated_set.save()
        url = reverse("admin:igcse_catalog_igcsegeneratedset_changelist")
        response = self.client.post(
            url,
            {
                "action": "action_publish_sets",
                "_selected_action": [str(self.generated_set.pk)],
            },
        )
        self.assertEqual(response.status_code, 302)
        self.generated_set.refresh_from_db()
        self.assertTrue(self.generated_set.is_published)
        self.assertTrue(self.generated_set.is_latest_published)
