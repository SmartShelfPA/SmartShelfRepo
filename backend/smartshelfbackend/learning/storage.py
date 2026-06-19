"""
Storage backend for protected PDF assets.

Files are written to ``settings.PROTECTED_MEDIA_ROOT`` which lives OUTSIDE
``MEDIA_ROOT``. This guarantees the uploaded PDFs are never exposed by the
dev static-media handler (``static(MEDIA_URL, ...)``) or a typical
``/media/`` web-server alias. The only way to read them is through the
signed-token streaming endpoint.
"""

from __future__ import annotations

from django.conf import settings
from django.core.files.storage import FileSystemStorage
from django.utils.deconstruct import deconstructible


@deconstructible
class ProtectedPdfStorage(FileSystemStorage):
    def __init__(self, **kwargs):
        kwargs.setdefault("location", settings.PROTECTED_MEDIA_ROOT)
        # No base_url → calling ``.url`` raises, preventing accidental public links.
        kwargs.setdefault("base_url", None)
        super().__init__(**kwargs)


# Module-level singleton referenced by the model FileField. Using a
# deconstructible class keeps migrations stable across machines.
protected_pdf_storage = ProtectedPdfStorage()
