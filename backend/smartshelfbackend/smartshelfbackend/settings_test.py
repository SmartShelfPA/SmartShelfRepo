"""Local/CI test settings: SQLite instead of Postgres.

    python manage.py test --settings=smartshelfbackend.settings_test
"""

import tempfile

from .settings import *  # noqa: F401,F403

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": ":memory:",
    }
}
PASSWORD_HASHERS = ["django.contrib.auth.hashers.MD5PasswordHasher"]
PROTECTED_MEDIA_ROOT = tempfile.mkdtemp(prefix="smartshelf-test-protected-")
