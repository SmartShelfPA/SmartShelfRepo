"""
IP-based rate limiting for unauthenticated auth endpoints (login, register,
password reset) that uses Django's cache backend.

Usage on an APIView:
    throttle_classes = [AuthRateThrottle]

Rates can be tuned via env vars:
    AUTH_RATE_LIMIT_LOGIN     — e.g. "10/min"  (default: "10/min")
    AUTH_RATE_LIMIT_REGISTER  — e.g. "5/min"   (default: "5/min")
"""

import os
from rest_framework.throttling import AnonRateThrottle


class LoginRateThrottle(AnonRateThrottle):
    scope = "login"
    rate = os.environ.get("AUTH_RATE_LIMIT_LOGIN", "10/min")


class RegisterRateThrottle(AnonRateThrottle):
    scope = "register"
    rate = os.environ.get("AUTH_RATE_LIMIT_REGISTER", "5/min")


class PasswordResetRateThrottle(AnonRateThrottle):
    scope = "password_reset"
    rate = os.environ.get("AUTH_RATE_LIMIT_PASSWORD_RESET", "5/min")
