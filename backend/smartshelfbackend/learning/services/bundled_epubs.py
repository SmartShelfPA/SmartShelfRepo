from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from django.conf import settings


def _bundled_root() -> Path:
    """Root of the bundled-igcse directory next to the repo root."""
    base = Path(settings.BASE_DIR)
    return (base.parent.parent / "bundled-igcse").resolve()


def bundled_epub_dir() -> Path:
    raw = getattr(settings, "BUNDLED_IGCSE_EPUB_DIR", "")
    if raw:
        return Path(str(raw)).resolve()
    return _bundled_root() / "epubs"


def bundled_pdf_dir() -> Path:
    raw = getattr(settings, "BUNDLED_IGCSE_PDF_DIR", "")
    if raw:
        return Path(str(raw)).resolve()
    return _bundled_root() / "pdfs"


def bundled_manifest_path() -> Path:
    raw = getattr(settings, "BUNDLED_IGCSE_MANIFEST", "")
    if raw:
        return Path(str(raw)).resolve()
    return _bundled_root() / "manifest.json"


def load_bundled_manifest() -> list[dict[str, Any]]:
    path = bundled_manifest_path()
    if not path.is_file():
        return []
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return []
    if not isinstance(data, list):
        return []
    return [x for x in data if isinstance(x, dict)]


def get_bundled_book(book_id: str) -> dict[str, Any] | None:
    needle = (book_id or "").strip()
    if not needle:
        return None
    for item in load_bundled_manifest():
        if str(item.get("id") or "").strip() == needle:
            return item
    return None


def _safe_filename(filename: str) -> str | None:
    """Return filename only if it is safe (no path traversal)."""
    f = (filename or "").strip()
    if not f or ".." in f or "/" in f or "\\" in f:
        return None
    return f


def resolve_bundled_epub_path(book_id: str) -> Path | None:
    meta = get_bundled_book(book_id)
    if not meta:
        return None
    filename = _safe_filename(str(meta.get("filename") or ""))
    if not filename:
        return None
    path = bundled_epub_dir() / filename
    return path if path.is_file() else None


def resolve_bundled_pdf_path(book_id: str) -> Path | None:
    meta = get_bundled_book(book_id)
    if not meta:
        return None
    filename = _safe_filename(str(meta.get("filename") or ""))
    if not filename:
        return None
    # PDFs live in pdfs/ subfolder.
    path = bundled_pdf_dir() / filename
    return path if path.is_file() else None


def resolve_bundled_file_path(book_id: str) -> tuple[Path, str] | None:
    """
    Resolve any bundled file (PDF or EPUB) for a given book_id.
    Returns (path, mime_type) or None.
    """
    meta = get_bundled_book(book_id)
    if not meta:
        return None
    filename = _safe_filename(str(meta.get("filename") or ""))
    if not filename:
        return None

    file_type = str(meta.get("type") or "").lower()

    if file_type == "pdf" or filename.lower().endswith(".pdf"):
        path = bundled_pdf_dir() / filename
        mime = "application/pdf"
    else:
        path = bundled_epub_dir() / filename
        mime = "application/epub+zip"

    return (path, mime) if path.is_file() else None


def list_bundled_books() -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for item in load_bundled_manifest():
        book_id = str(item.get("id") or "").strip()
        if not book_id:
            continue
        if resolve_bundled_file_path(book_id) is None:
            continue
        out.append(item)
    return out
