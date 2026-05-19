"""Stable JSON envelope for ``/api/igcse/*`` responses."""

from __future__ import annotations

from typing import Any

from rest_framework.response import Response

SCHEMA_VERSION = "1.0"


def envelope_ok(data: dict[str, Any], *, status_code: int = 200) -> Response:
    return Response(
        {
            "success": True,
            "schema_version": SCHEMA_VERSION,
            "data": data,
        },
        status=status_code,
    )


def envelope_error(
    *,
    code: str,
    message: str,
    status_code: int = 400,
    detail: str | None = None,
    validation: dict[str, Any] | None = None,
) -> Response:
    err: dict[str, Any] = {"code": code, "message": message}
    if detail:
        err["detail"] = detail
    if validation:
        err["validation"] = validation
    return Response(
        {"success": False, "schema_version": SCHEMA_VERSION, "error": err},
        status=status_code,
    )
