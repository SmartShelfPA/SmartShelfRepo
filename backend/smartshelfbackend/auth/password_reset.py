"""
Password-reset helpers: durable challenges + SMTP delivery checks.
"""
from __future__ import annotations

import hashlib
import hmac
import logging
import secrets
import string
from datetime import timedelta

from django.conf import settings
from django.core.mail import send_mail
from django.utils import timezone

from users.models import PasswordResetChallenge, UserProfile

logger = logging.getLogger(__name__)

RESET_CODE_TTL = timedelta(minutes=15)
RESET_CODE_MAX_ATTEMPTS = 5


def generate_reset_code() -> str:
    return "".join(secrets.choice(string.digits) for _ in range(6))


def hash_reset_code(code: str) -> str:
    secret = (settings.SECRET_KEY or "smartshelf").encode("utf-8")
    return hmac.new(secret, code.strip().encode("utf-8"), hashlib.sha256).hexdigest()


def codes_match(plain_code: str, code_hash: str) -> bool:
    return hmac.compare_digest(hash_reset_code(plain_code), code_hash)


def email_delivery_ready() -> tuple[bool, str]:
    """
    Return (ok, reason). Console/dummy backends and placeholder SMTP creds
    are treated as not ready for real inbox delivery.
    """
    backend = (getattr(settings, "EMAIL_BACKEND", "") or "").lower()
    if any(token in backend for token in ("console", "dummy", "locmem", "filebased")):
        return False, "Email backend is console/dummy — messages are not delivered to inboxes."

    host = (getattr(settings, "EMAIL_HOST", "") or "").strip()
    user = (getattr(settings, "EMAIL_HOST_USER", "") or "").strip()
    password = (getattr(settings, "EMAIL_HOST_PASSWORD", "") or "").strip()
    if not host or not user or not password:
        return False, "SMTP host/user/password are not configured."

    placeholders = {
        "you@gmail.com",
        "your-address@gmail.com",
        "your-gmail-app-password",
        "changeme",
        "password",
    }
    if user.lower() in placeholders or password.lower() in placeholders:
        return False, "SMTP credentials look like placeholders from .env.example."

    return True, ""


def create_challenge(user: UserProfile, email: str, code: str) -> PasswordResetChallenge:
    email_norm = email.lower().strip()
    PasswordResetChallenge.objects.filter(email__iexact=email_norm).delete()
    return PasswordResetChallenge.objects.create(
        email=email_norm,
        user=user,
        code_hash=hash_reset_code(code),
        expires_at=timezone.now() + RESET_CODE_TTL,
    )


def get_active_challenge(email: str) -> PasswordResetChallenge | None:
    email_norm = email.lower().strip()
    challenge = (
        PasswordResetChallenge.objects.filter(email__iexact=email_norm)
        .order_by("-created_at")
        .first()
    )
    if not challenge:
        return None
    if challenge.is_expired:
        challenge.delete()
        return None
    return challenge


def send_reset_email(email: str, code: str) -> None:
    send_mail(
        subject="SmartShelf password reset code",
        message=(
            f"Your SmartShelf password reset code is {code}.\n\n"
            "This code expires in 15 minutes.\n\n"
            "If you did not request a password reset, you can ignore this email."
        ),
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[email],
        fail_silently=False,
    )
