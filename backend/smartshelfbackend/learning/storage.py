"""
Storage backend for protected PDF assets.

Files are written to ``settings.PROTECTED_MEDIA_ROOT`` which lives OUTSIDE
``MEDIA_ROOT``. This guarantees the uploaded PDFs are never exposed by the
dev static-media handler (``static(MEDIA_URL, ...)``) or a typical
``/media/`` web-server alias. The only way to read them is through the
signed-token streaming endpoint.

When ``settings.PROTECTED_STORAGE_BACKEND == "database"`` new files are kept
in the ``learning.StoredFile`` table instead, because hosts such as Render
wipe the local disk on every deploy. Reads always check the database first
and fall back to disk, so files saved under either mode keep working.
"""

from __future__ import annotations

from django.apps import apps
from django.conf import settings
from django.core.files.base import ContentFile
from django.core.files.storage import FileSystemStorage
from django.db import connection
from django.utils.deconstruct import deconstructible


def _stored_file_model():
    model = apps.get_model("learning", "StoredFile")
    if model._meta.db_table not in connection.introspection.table_names():
        return None
    return model


def _use_database() -> bool:
    return getattr(settings, "PROTECTED_STORAGE_BACKEND", "filesystem") == "database"


@deconstructible
class ProtectedPdfStorage(FileSystemStorage):
    def __init__(self, **kwargs):
        kwargs.setdefault("location", settings.PROTECTED_MEDIA_ROOT)
        # No base_url → calling ``.url`` raises, preventing accidental public links.
        kwargs.setdefault("base_url", None)
        super().__init__(**kwargs)

    def _db_row(self, name: str):
        model = _stored_file_model()
        if model is None:
            return None
        return model.objects.filter(name=name).first()

    def _save(self, name, content):
        model = _stored_file_model() if _use_database() else None
        if model is None:
            return super()._save(name, content)
        content.seek(0)
        data = content.read()
        model.objects.update_or_create(name=name, defaults={"content": data, "size": len(data)})
        return name

    def _open(self, name, mode="rb"):
        row = self._db_row(name)
        if row is not None:
            f = ContentFile(bytes(row.content), name=name)
            f.mode = mode
            return f
        return super()._open(name, mode)

    def exists(self, name):
        if self._db_row(name) is not None:
            return True
        return super().exists(name)

    def delete(self, name):
        model = _stored_file_model()
        if model is not None and model.objects.filter(name=name).delete()[0]:
            return
        super().delete(name)

    def size(self, name):
        row = self._db_row(name)
        if row is not None:
            return row.size
        return super().size(name)


# Module-level singleton referenced by the model FileField. Using a
# deconstructible class keeps migrations stable across machines.
protected_pdf_storage = ProtectedPdfStorage()
