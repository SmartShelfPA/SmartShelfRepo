"""
Signed, short-lived download tokens for protected PDF assets.

A token is an opaque, signed (HMAC via ``SECRET_KEY``) string that encodes the
``asset_id`` and ``user_id`` it was minted for, plus an issue timestamp. It is
verified with a ``max_age`` so it expires automatically. The signature itself
is the authorization to stream the file — no permanent public URL is exposed.
"""

from __future__ import annotations

from typing import Any

from django.conf import settings
from django.core import signing

_SALT = "learning.protected_pdf.download"


class TokenError(Exception):
    """Raised when a download token is invalid, tampered with, or expired."""


def make_download_token(*, asset_id: str, user_id: Any) -> str:
    payload = {"asset_id": str(asset_id), "user_id": str(user_id)}
    return signing.dumps(payload, salt=_SALT)


def verify_download_token(token: str, *, asset_id: str, user_id: Any) -> None:
    """Raise :class:`TokenError` unless ``token`` is valid for this asset+user."""
    max_age = getattr(settings, "PROTECTED_DOWNLOAD_TOKEN_MAX_AGE", 300)
    try:
        data = signing.loads(token, salt=_SALT, max_age=max_age)
    except signing.SignatureExpired as exc:
        raise TokenError("Download link expired.") from exc
    except signing.BadSignature as exc:
        raise TokenError("Invalid download link.") from exc

    if not isinstance(data, dict):
        raise TokenError("Malformed download token.")
    if data.get("asset_id") != str(asset_id):
        raise TokenError("Token does not match this asset.")
    if data.get("user_id") != str(user_id):
        raise TokenError("Token does not match this user.")


def client_ip(request) -> str | None:
    xff = (request.META.get("HTTP_X_FORWARDED_FOR") or "").split(",")[0].strip()
    return xff or request.META.get("REMOTE_ADDR")
