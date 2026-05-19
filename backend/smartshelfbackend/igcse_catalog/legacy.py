"""
Retired live Open IGCSE proxy endpoints (HTTP 410).

These routes remain registered temporarily so older clients receive a clear
migration message instead of 404. Remove after Expo migrates to chapters/sets.
"""

from __future__ import annotations

from django.http import HttpRequest
from rest_framework.response import Response

from igcse_catalog.deprecation import attach_deprecation
from igcse_catalog.envelope import envelope_error

_MESSAGE = (
    "The live Open IGCSE API proxy was removed. "
    "Use study-agent catalog routes: /api/igcse/chapters/ and /api/igcse/sets/."
)


def _gone(request: HttpRequest, *, successor_path: str) -> Response:
    resp = envelope_error(
        code="deprecated_endpoint",
        message=_MESSAGE,
        status_code=410,
        detail=f"Successor: {successor_path}",
    )
    return attach_deprecation(resp, successor_path=successor_path)


def deprecated_topics_response(request: HttpRequest) -> Response:
    return _gone(request, successor_path="/api/igcse/chapters/")


def deprecated_questions_response(request: HttpRequest) -> Response:
    return _gone(request, successor_path="/api/igcse/sets/")


def deprecated_search_response(request: HttpRequest) -> Response:
    return _gone(request, successor_path="/api/igcse/subjects/")
