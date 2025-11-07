from .models import Token
from users.models import User


def get_user_from_token(token_key):
    """
    Get user from token key.
    Returns User object if token is valid, None otherwise.
    """
    try:
        token = Token.objects.get(key=token_key)
        return token.user
    except Token.DoesNotExist:
        return None


def is_authenticated(token_key):
    """
    Check if a token is valid.
    Returns True if token exists, False otherwise.
    """
    return Token.objects.filter(key=token_key).exists()

