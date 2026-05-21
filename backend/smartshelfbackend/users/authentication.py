from rest_framework.authentication import BaseAuthentication, TokenAuthentication

from users.auth_bypass import auth_free_window_active, get_bypass_shadow_user


class DevBypassAuthentication(BaseAuthentication):
    """
    During AUTH_FREE_FOR_MINUTES (from process start), authenticate requests that do not
    send a non-empty Bearer token as AUTH_BYPASS_USER_ID / superuser / first UserProfile.
    """

    def authenticate(self, request):
        if not auth_free_window_active():
            return None
        raw = (request.META.get("HTTP_AUTHORIZATION") or "").strip()
        if raw.startswith("Bearer ") and raw[7:].strip():
            return None

        user = get_bypass_shadow_user()
        if not user:
            return None
        return (user, None)


class BearerTokenAuthentication(TokenAuthentication):
    keyword = "Bearer"
