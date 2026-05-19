"""
Ingest one study-agent generated set from a JSON manifest (and optional source folder).

Examples:
  python manage.py ingest_igcse_set manifest.json
  python manage.py ingest_igcse_set manifest.json --source-dir ./pipeline/out/math-algebra
  python manage.py ingest_igcse_set manifest.json --publish-latest --dry-run
"""

from __future__ import annotations

import json
from pathlib import Path

from django.core.management.base import BaseCommand, CommandError

from igcse_catalog.exceptions import IngestDuplicateError, IngestValidationError
from igcse_catalog.services.ingestion import ingest_generated_set


class Command(BaseCommand):
    help = "Ingest a study-agent generated set JSON manifest into the IGCSE catalog."

    def add_arguments(self, parser):
        parser.add_argument("manifest_path", type=str, help="Path to manifest JSON file")
        parser.add_argument(
            "--source-dir",
            type=str,
            default="",
            help="Pipeline output folder for relative pdf_path / artifact_path entries",
        )
        parser.add_argument(
            "--publish-latest",
            action="store_true",
            help="Mark ingested set as the latest published release for its chapter",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Validate manifest only; do not write to the database",
        )

    def handle(self, *args, **options):
        path = Path(options["manifest_path"])
        if not path.is_file():
            raise CommandError(f"Manifest not found: {path}")

        try:
            payload = json.loads(path.read_text(encoding="utf-8"))
        except json.JSONDecodeError as exc:
            raise CommandError(f"Invalid JSON: {exc}") from exc

        if not isinstance(payload, dict):
            raise CommandError("Manifest root must be a JSON object")

        source_dir_raw = str(options.get("source_dir") or payload.get("source_folder") or "").strip()
        source_dir = Path(source_dir_raw).resolve() if source_dir_raw else None
        if source_dir is not None and not source_dir.is_dir():
            raise CommandError(f"--source-dir is not a directory: {source_dir}")

        if options["publish_latest"]:
            payload = {**payload, "publish_as_latest": True, "is_published": True}

        if options["dry_run"]:
            self.stdout.write(self.style.WARNING("Dry run — manifest parsed successfully."))
            self.stdout.write(
                f"  subject={payload.get('subject_slug')} "
                f"chapter={payload.get('chapter_slug')} "
                f"bundle={payload.get('pipeline_bundle_id') or '(none)'}"
            )
            return

        try:
            result = ingest_generated_set(payload, source_dir=source_dir)
        except IngestDuplicateError as exc:
            raise CommandError(str(exc)) from exc
        except IngestValidationError as exc:
            raise CommandError(str(exc)) from exc
        except ValueError as exc:
            raise CommandError(str(exc)) from exc

        action = "Created" if result.created else "Updated"
        self.stdout.write(
            self.style.SUCCESS(
                f"{action} set {result.generated_set.id} "
                f"v{result.version} ({result.generated_set.subject_slug}/"
                f"{result.generated_set.chapter_slug}) "
                f"latest={result.generated_set.is_latest_published}"
            )
        )
