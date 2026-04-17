from rest_framework.authtoken.models import Token


def get_user_from_token(token_key):
    token = Token.objects.filter(key=token_key).select_related("user").first()
    return token.user if token else None


def is_authenticated(token_key):
    return Token.objects.filter(key=token_key).exists()

