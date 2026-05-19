"""Ingest workflow errors."""

from __future__ import annotations


class IngestError(Exception):
    """Base ingest failure."""


class IngestDuplicateError(IngestError):
    """A non-versioned duplicate already exists for this chapter/bundle."""

    def __init__(self, message: str, *, existing_set_id: str | None = None):
        super().__init__(message)
        self.existing_set_id = existing_set_id


class IngestValidationError(IngestError):
    """Payload or filesystem validation failed."""
