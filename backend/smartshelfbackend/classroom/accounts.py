"""Helpers for creating school-managed accounts with temporary passwords."""

from __future__ import annotations

import re
import secrets
import string

from rest_framework.authtoken.models import Token

from users.models import UserProfile

JOIN_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"


def generate_join_code(length: int = 6) -> str:
    return "".join(secrets.choice(JOIN_CODE_ALPHABET) for _ in range(length))


def generate_temp_password() -> str:
    """Satisfies the app's rules: upper, lower, digit, symbol, 8+ chars."""
    word = secrets.choice(["Shelf", "Study", "Learn", "Books", "Smart", "Pages"])
    digits = f"{secrets.randbelow(9000) + 1000}"
    tail = "".join(secrets.choice(string.ascii_lowercase) for _ in range(3))
    return f"{word}{digits}!{tail}"


def unique_username(full_name: str, preferred: str = "") -> str:
    base = re.sub(r"[^a-z0-9_]", "", (preferred or "").strip().lower())
    if not base:
        parts = [p for p in re.split(r"\s+", (full_name or "").strip().lower()) if p]
        base = re.sub(r"[^a-z0-9_]", "", "_".join(parts[:2])) or "user"
    base = base[:24]
    candidate = base
    while UserProfile.objects.filter(username=candidate).exists():
        candidate = f"{base}{secrets.randbelow(900) + 100}"
    return candidate


def set_temp_password(user: UserProfile) -> str:
    password = generate_temp_password()
    user.set_password(password)
    user.save(update_fields=["password"])
    Token.objects.filter(user=user).delete()
    user.clear_failed_logins()
    return password
