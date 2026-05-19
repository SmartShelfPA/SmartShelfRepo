from __future__ import annotations

from django.db.models.fields.files import FieldFile
from django.http import HttpRequest


def resolve_asset_url(
    request: HttpRequest | None,
    *,
    file_field: FieldFile | None = None,
    url_field: str = "",
) -> str:
    """Prefer explicit URL; otherwise absolute URI for uploaded file."""
    explicit = (url_field or "").strip()
    if explicit:
        return explicit
    if file_field and getattr(file_field, "name", None):
        try:
            relative = file_field.url
        except ValueError:
            return ""
        if request is not None:
            return request.build_absolute_uri(relative)
        return relative
    return ""
