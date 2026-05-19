"""HTTP deprecation headers for retired live-proxy IGCSE routes."""

from __future__ import annotations

from rest_framework.response import Response


def attach_deprecation(response: Response, *, successor_path: str) -> Response:
    response["Deprecation"] = "true"
    response["Link"] = f'<{successor_path}>; rel="successor-version"'
    return response
