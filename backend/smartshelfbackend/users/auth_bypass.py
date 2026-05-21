"""
Temporary dev-only API bypass: authenticate Bearer-less requests as a shadow user.

Controlled by AUTH_FREE_FOR_MINUTES (minutes from Django process start).
Never enable in production.
"""

from __future__ import annotations

import logging
import time

from django.conf import settings

logger = logging.getLogger(__name__)

_deadline_monotonic: float | None = None


def configure_deadline_minutes(minutes: int) -> None:
    """Call once from Django settings after AUTH_FREE_FOR_MINUTES is resolved."""
    global _deadline_monotonic
    if minutes <= 0:
        _deadline_monotonic = None
        return
    _deadline_monotonic = time.monotonic() + minutes * 60
    logger.warning(
        "AUTH_FREE_FOR_MINUTES=%s: until this process timer expires, API requests "
        "without a Bearer token are treated as AUTH_BYPASS user. Remove AUTH_FREE_FOR_MINUTES "
        "for production.",
        minutes,
    )


def auth_free_window_active() -> bool:
    if _deadline_monotonic is None:
        return False
    return time.monotonic() < _deadline_monotonic


def get_bypass_shadow_user():
    """User to attach when Bearer is omitted during AUTH_FREE_FOR_MINUTES window."""
    # Local import avoids AppRegistry cycles during Django startup.
    from users.models import UserProfile

    uid = (getattr(settings, "AUTH_BYPASS_USER_ID", None) or "").strip()
    if uid:
        u = UserProfile.objects.filter(pk=uid).first()
        if u:
            return u
        logger.warning(
            "AUTH_BYPASS_USER_ID=%s not found; falling back to superuser/first user.",
            uid,
        )
    return (
        UserProfile.objects.filter(is_superuser=True).first()
        or UserProfile.objects.order_by("pk").first()
    )
