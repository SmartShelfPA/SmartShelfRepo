"""
Google Sign-In backend helpers.

Flow supported:
  POST /api/v1/auth/google/  { "code": "<auth_code>", "redirect_uri": "..." }

  The frontend receives an authorization code (no PKCE — compatible with
  Expo Go).  This backend exchanges it for tokens using the client secret,
  extracts the id_token, verifies it against Google's JWKS, and finds or
  creates the SmartShelf user account.

── Setup steps ────────────────────────────────────────────────────────────
Backend .env (or docker-compose environment):
  GOOGLE_CLIENT_ID_WEB=xxx.apps.googleusercontent.com
  GOOGLE_CLIENT_SECRET_WEB=GOCSPX-xxxx   ← Credentials → Web client → Secret

Frontend .env:
  EXPO_PUBLIC_GOOGLE_CLIENT_ID_WEB=xxx.apps.googleusercontent.com

Google Cloud Console → Credentials → Web client → Authorised redirect URIs:
  https://auth.expo.io/@adesol/smartshelf
──────────────────────────────────────────────────────────────────────────
"""

from __future__ import annotations

import logging
import os
import re

import requests as http_requests
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token as google_id_token

from users.models import UserProfile

logger = logging.getLogger(__name__)

_GOOGLE_CLIENT_ID_WEB = os.environ.get("GOOGLE_CLIENT_ID_WEB", "")
_GOOGLE_CLIENT_SECRET_WEB = os.environ.get("GOOGLE_CLIENT_SECRET_WEB", "")
_GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token"

# All accepted audience values for id_token verification.
_GOOGLE_CLIENT_IDS: list[str] = [
    v
    for v in (
        os.environ.get("GOOGLE_CLIENT_ID_IOS", ""),
        os.environ.get("GOOGLE_CLIENT_ID_ANDROID", ""),
        _GOOGLE_CLIENT_ID_WEB,
    )
    if v
]


class GoogleAuthError(Exception):
    """Raised when the OAuth flow or token verification fails."""


def exchange_code_for_id_token(code: str, redirect_uri: str) -> str:
    """
    Exchange a Google authorization code for tokens and return the id_token string.

    Requires GOOGLE_CLIENT_ID_WEB and GOOGLE_CLIENT_SECRET_WEB to be set.

    Raises:
        GoogleAuthError: exchange failed or id_token missing from response.
    """
    if not _GOOGLE_CLIENT_ID_WEB:
        raise GoogleAuthError(
            "GOOGLE_CLIENT_ID_WEB is not configured on the server."
        )
    if not _GOOGLE_CLIENT_SECRET_WEB:
        raise GoogleAuthError(
            "GOOGLE_CLIENT_SECRET_WEB is not configured on the server. "
            "Add it from Google Cloud Console → Credentials → Web client → Client secret."
        )

    try:
        resp = http_requests.post(
            _GOOGLE_TOKEN_ENDPOINT,
            data={
                "code": code,
                "client_id": _GOOGLE_CLIENT_ID_WEB,
                "client_secret": _GOOGLE_CLIENT_SECRET_WEB,
                "redirect_uri": redirect_uri,
                "grant_type": "authorization_code",
            },
            timeout=10,
        )
        resp.raise_for_status()
        token_data = resp.json()
    except Exception as exc:
        raise GoogleAuthError(f"Token exchange with Google failed: {exc}") from exc

    id_token_str = token_data.get("id_token")
    if not id_token_str:
        raise GoogleAuthError(
            f"Google token exchange did not return an id_token. "
            f"Response keys: {list(token_data.keys())}"
        )

    return id_token_str


def verify_google_id_token(token: str) -> dict:
    """
    Verify a Google id_token JWT and return the decoded claims.

    Raises:
        GoogleAuthError: token is invalid, expired, or not for this app.
    """
    if not _GOOGLE_CLIENT_IDS:
        raise GoogleAuthError(
            "No Google Client IDs configured on the server. "
            "Set GOOGLE_CLIENT_ID_WEB in the environment."
        )

    try:
        claims = google_id_token.verify_oauth2_token(
            token,
            google_requests.Request(),
            audience=None,
        )
    except Exception as exc:
        raise GoogleAuthError(f"Token verification failed: {exc}") from exc

    if claims.get("aud") not in _GOOGLE_CLIENT_IDS:
        raise GoogleAuthError(
            "Token audience does not match any configured Google Client ID."
        )

    if not claims.get("email_verified"):
        raise GoogleAuthError("Google account email is not verified.")

    return claims


def _slugify_google_username(given_name: str, family_name: str, sub: str) -> str:
    raw = f"{given_name}{family_name}".lower()
    base = re.sub(r"[^a-z0-9]", "", raw) or "user"
    return f"{base}_{sub[-6:]}"


def get_or_create_google_user(claims: dict) -> tuple[UserProfile, bool]:
    """
    Find or create a UserProfile from verified Google id_token claims.

    Returns:
        (user, created) — created=True on first sign-in.
    """
    email: str = claims["email"]
    sub: str = claims["sub"]
    given_name: str = claims.get("given_name", "")
    family_name: str = claims.get("family_name", "")
    picture_url: str = claims.get("picture", "")

    existing = UserProfile.objects.filter(email__iexact=email).first()
    if existing:
        if not existing.avatar_url and picture_url:
            existing.avatar_url = picture_url
            existing.save(update_fields=["avatar_url"])
        return existing, False

    username = _slugify_google_username(given_name, family_name, sub)
    base_username = username
    counter = 1
    while UserProfile.objects.filter(username=username).exists():
        username = f"{base_username}{counter}"
        counter += 1

    full_name = f"{given_name} {family_name}".strip() or email.split("@")[0]

    user = UserProfile.objects.create_user(
        username=username,
        email=email,
        password=None,
        full_name=full_name,
        role=UserProfile.Role.STUDENT,
        avatar_url=picture_url,
    )
    logger.info("Created new user via Google Sign-In: %s (%s)", username, email)
    return user, True
