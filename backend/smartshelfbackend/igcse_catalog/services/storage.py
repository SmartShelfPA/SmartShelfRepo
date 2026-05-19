"""
Attach pipeline files using Django's default file storage (local MEDIA or S3 via STORAGES).
"""

from __future__ import annotations

import hashlib
from pathlib import Path

from django.core.files import File
from django.core.files.storage import default_storage


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def save_local_file_to_storage(*, local_path: Path, storage_path: str) -> str:
    """
    Copy a local file into default_storage. Returns the storage-relative name.
    """
    if not local_path.is_file():
        raise FileNotFoundError(f"File not found: {local_path}")
    with local_path.open("rb") as fh:
        return default_storage.save(storage_path, File(fh))


def resolve_path_under_source_dir(source_dir: Path | None, relative: str) -> Path | None:
    rel = (relative or "").strip()
    if not rel:
        return None
    candidate = Path(rel)
    if candidate.is_file():
        return candidate.resolve()
    if source_dir is not None:
        joined = (source_dir / rel).resolve()
        if joined.is_file():
            return joined
    return None
