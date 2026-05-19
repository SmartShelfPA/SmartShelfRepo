from __future__ import annotations

import json
import tempfile
from io import StringIO
from pathlib import Path

from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.test import TestCase
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from igcse_catalog.exceptions import IngestDuplicateError
from igcse_catalog.models import IGCSEChapter, IGCSEGeneratedSet, IGCSESubject
from igcse_catalog.services.ingestion import ingest_generated_set, mark_latest_published

User = get_user_model()


class IngestionServiceTests(TestCase):
    def test_creates_subject_chapter_and_set(self):
        result = ingest_generated_set(
            {
                "subject_slug": "chemistry",
                "chapter_slug": "acids",
                "is_published": True,
                "publish_as_latest": True,
                "pipeline_bundle_id": "chem-acids-v1",
                "practice_paper": {"pdf_url": "https://cdn.example.com/p.pdf"},
                "worked_solutions": {"pdf_url": "https://cdn.example.com/s.pdf"},
                "simulator": {
                    "simulator_set_id": "sim-acids",
                    "public_url": "https://sim.example.com/acids",
                },
            }
        )
        self.assertTrue(result.created)
        self.assertTrue(result.generated_set.is_latest_published)
        self.assertTrue(IGCSESubject.objects.filter(slug="chemistry", is_published=True).exists())
        self.assertTrue(
            IGCSEChapter.objects.filter(subject__slug="chemistry", slug="acids").exists()
        )

    def test_upsert_same_bundle_id(self):
        payload = {
            "subject_slug": "biology",
            "chapter_slug": "cells",
            "pipeline_bundle_id": "bio-cells-v1",
            "quality_score": 0.8,
            "practice_paper": {"pdf_url": "https://cdn.example.com/p1.pdf"},
            "worked_solutions": {"pdf_url": "https://cdn.example.com/s1.pdf"},
            "simulator": {"simulator_set_id": "sim-cells", "public_url": "https://sim.example.com"},
        }
        first = ingest_generated_set(payload)
        payload["quality_score"] = 0.95
        second = ingest_generated_set(payload)
        self.assertTrue(first.created)
        self.assertFalse(second.created)
        self.assertEqual(first.generated_set.id, second.generated_set.id)
        second.generated_set.refresh_from_db()
        self.assertEqual(second.generated_set.quality_score, 0.95)

    def test_reject_duplicate_without_bundle_id(self):
        base = {
            "subject_slug": "physics",
            "chapter_slug": "waves",
            "practice_paper": {"pdf_url": "https://cdn.example.com/p.pdf"},
            "worked_solutions": {"pdf_url": "https://cdn.example.com/s.pdf"},
            "simulator": {"simulator_set_id": "sim-waves", "public_url": "https://sim.example.com"},
        }
        ingest_generated_set(base)
        with self.assertRaises(IngestDuplicateError):
            ingest_generated_set(base)

    def test_version_creates_second_set(self):
        base = {
            "subject_slug": "physics",
            "chapter_slug": "energy",
            "on_duplicate": "version",
            "practice_paper": {"pdf_url": "https://cdn.example.com/p.pdf"},
            "worked_solutions": {"pdf_url": "https://cdn.example.com/s.pdf"},
            "simulator": {"simulator_set_id": "sim-energy", "public_url": "https://sim.example.com"},
        }
        ingest_generated_set({**base, "pipeline_bundle_id": "phys-energy-v1"})
        second = ingest_generated_set(
            {**base, "pipeline_bundle_id": "phys-energy-v2", "on_duplicate": "version"}
        )
        self.assertEqual(
            IGCSEGeneratedSet.objects.filter(chapter__slug="energy").count(),
            2,
        )
        self.assertEqual(second.version, 2)

    def test_mark_latest_unsets_siblings(self):
        subject = IGCSESubject.objects.create(slug="math", title="Math", is_published=True)
        chapter = IGCSEChapter.objects.create(
            subject=subject, slug="graphs", title="Graphs", is_published=True
        )
        older = IGCSEGeneratedSet.objects.create(
            chapter=chapter,
            generated_at=timezone.now(),
            is_published=True,
            is_latest_published=True,
            version=1,
        )
        newer = IGCSEGeneratedSet.objects.create(
            chapter=chapter,
            generated_at=timezone.now(),
            is_published=True,
            version=2,
        )
        mark_latest_published(newer)
        older.refresh_from_db()
        newer.refresh_from_db()
        self.assertFalse(older.is_latest_published)
        self.assertTrue(newer.is_latest_published)

    def test_ingest_from_source_dir_paths(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            paper = root / "practice.pdf"
            solutions = root / "solutions.pdf"
            paper.write_bytes(b"%PDF-1.4 practice")
            solutions.write_bytes(b"%PDF-1.4 solutions")

            result = ingest_generated_set(
                {
                    "subject_slug": "english",
                    "chapter_slug": "writing",
                    "pipeline_bundle_id": "eng-writing-files",
                    "source_folder": str(root),
                    "practice_paper": {"pdf_path": "practice.pdf"},
                    "worked_solutions": {"pdf_path": "solutions.pdf"},
                    "simulator": {
                        "simulator_set_id": "sim-writing",
                        "public_url": "https://sim.example.com/writing",
                    },
                },
                source_dir=root,
            )
            self.assertTrue(result.generated_set.practice_paper.pdf_file.name)
            self.assertTrue(result.generated_set.worked_solutions.pdf_file.name)


class IngestManagementCommandTests(TestCase):
    def test_dry_run_command(self):
        with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False) as fh:
            json.dump(
                {
                    "subject_slug": "history",
                    "chapter_slug": "ww2",
                    "practice_paper": {"pdf_url": "https://cdn.example.com/p.pdf"},
                    "worked_solutions": {"pdf_url": "https://cdn.example.com/s.pdf"},
                    "simulator": {
                        "simulator_set_id": "sim-ww2",
                        "public_url": "https://sim.example.com",
                    },
                },
                fh,
            )
            path = fh.name

        out = StringIO()
        call_command("ingest_igcse_set", path, "--dry-run", stdout=out)
        self.assertIn("Dry run", out.getvalue())
        self.assertFalse(IGCSESubject.objects.filter(slug="history").exists())


class IngestApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_superuser(
            username="ingestadmin",
            email="ingestadmin@example.com",
            password="adminpass123",
        )

    def test_duplicate_returns_409(self):
        payload = {
            "subject_slug": "geography",
            "chapter_slug": "climate",
            "pipeline_bundle_id": "geo-climate-1",
            "practice_paper": {"pdf_url": "https://cdn.example.com/p.pdf"},
            "worked_solutions": {"pdf_url": "https://cdn.example.com/s.pdf"},
            "simulator": {
                "simulator_set_id": "sim-climate",
                "public_url": "https://sim.example.com",
            },
        }
        self.client.force_authenticate(user=self.admin)
        first = self.client.post(reverse("igcse-ingest"), payload, format="json")
        self.assertEqual(first.status_code, 201)

        dup = self.client.post(
            reverse("igcse-ingest"),
            {**payload, "on_duplicate": "reject"},
            format="json",
        )
        self.assertEqual(dup.status_code, 409)
        self.assertEqual(dup.json()["error"]["code"], "duplicate_set")
