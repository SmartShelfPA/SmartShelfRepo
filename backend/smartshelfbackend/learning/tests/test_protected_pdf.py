from __future__ import annotations

import time

from django.contrib.auth import get_user_model
from django.core.files.base import ContentFile
from django.test import TestCase, override_settings
from django.urls import reverse
from rest_framework.test import APIClient

from learning.models import ProtectedPdfAccessLog, ProtectedPdfAsset

User = get_user_model()

PDF_BYTES = b"%PDF-1.4\n%fake test pdf\n%%EOF"


def make_asset(**overrides) -> ProtectedPdfAsset:
    defaults = dict(
        title="Medical Biochemistry",
        subject="Biology",
        published=True,
        rights_status=ProtectedPdfAsset.RightsStatus.APPROVED,
        access_level=ProtectedPdfAsset.AccessLevel.AUTHENTICATED,
    )
    defaults.update(overrides)
    asset = ProtectedPdfAsset(**defaults)
    asset.pdf_file.save("x.pdf", ContentFile(PDF_BYTES), save=False)
    asset.save()
    return asset


class ProtectedPdfFlowTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username="student1", email="s1@example.com", password="pass12345"
        )
        self.asset = make_asset()

    def test_list_requires_auth(self):
        resp = self.client.get(reverse("protected-pdf-list"))
        self.assertIn(resp.status_code, (401, 403))

    def test_list_returns_metadata_without_file_path(self):
        self.client.force_authenticate(self.user)
        resp = self.client.get(reverse("protected-pdf-list"))
        self.assertEqual(resp.status_code, 200)
        body = resp.json()
        row = body[0] if isinstance(body, list) else body["results"][0]
        self.assertEqual(row["title"], "Medical Biochemistry")
        # No raw file path / public URL must ever leak.
        self.assertNotIn("pdf_file", row)
        self.assertNotIn("file", row)

    def test_authorize_then_download_succeeds(self):
        self.client.force_authenticate(self.user)
        auth = self.client.post(
            reverse("protected-pdf-authorize", args=[self.asset.id])
        )
        self.assertEqual(auth.status_code, 200)
        token = auth.json()["token"]
        self.assertTrue(token)

        dl = self.client.get(
            reverse("protected-pdf-download", args=[self.asset.id]), {"token": token}
        )
        self.assertEqual(dl.status_code, 200)
        self.assertEqual(dl["Content-Type"], "application/pdf")
        self.assertTrue(
            ProtectedPdfAccessLog.objects.filter(
                asset=self.asset, event=ProtectedPdfAccessLog.Event.DOWNLOADED
            ).exists()
        )

    def test_download_rejects_missing_token(self):
        resp = self.client.get(reverse("protected-pdf-download", args=[self.asset.id]))
        self.assertEqual(resp.status_code, 400)

    def test_download_rejects_tampered_token(self):
        self.client.force_authenticate(self.user)
        token = self.client.post(
            reverse("protected-pdf-authorize", args=[self.asset.id])
        ).json()["token"]
        bad = token[:-2] + ("aa" if not token.endswith("aa") else "bb")
        resp = self.client.get(
            reverse("protected-pdf-download", args=[self.asset.id]), {"token": bad}
        )
        self.assertEqual(resp.status_code, 403)

    @override_settings(PROTECTED_DOWNLOAD_TOKEN_MAX_AGE=1)
    def test_download_rejects_expired_token(self):
        self.client.force_authenticate(self.user)
        token = self.client.post(
            reverse("protected-pdf-authorize", args=[self.asset.id])
        ).json()["token"]
        time.sleep(2)
        resp = self.client.get(
            reverse("protected-pdf-download", args=[self.asset.id]), {"token": token}
        )
        self.assertEqual(resp.status_code, 403)
        self.assertEqual(resp.json()["code"], "token_invalid")

    def test_authorize_denied_when_unpublished(self):
        self.asset.published = False
        self.asset.save(update_fields=["published"])
        self.client.force_authenticate(self.user)
        resp = self.client.post(
            reverse("protected-pdf-authorize", args=[self.asset.id])
        )
        self.assertEqual(resp.status_code, 403)
        self.assertEqual(resp.json()["code"], "access_denied")
        self.assertTrue(
            ProtectedPdfAccessLog.objects.filter(
                asset=self.asset, event=ProtectedPdfAccessLog.Event.DENIED
            ).exists()
        )

    def test_download_revoked_after_unpublish(self):
        """A still-valid token must not stream once the asset is revoked."""
        self.client.force_authenticate(self.user)
        token = self.client.post(
            reverse("protected-pdf-authorize", args=[self.asset.id])
        ).json()["token"]
        self.asset.published = False
        self.asset.save(update_fields=["published"])
        resp = self.client.get(
            reverse("protected-pdf-download", args=[self.asset.id]), {"token": token}
        )
        self.assertEqual(resp.status_code, 410)
        self.assertEqual(resp.json()["code"], "revoked")

    def test_staff_only_asset_hidden_from_students(self):
        make_asset(
            title="Staff Manual",
            access_level=ProtectedPdfAsset.AccessLevel.STAFF,
        )
        self.client.force_authenticate(self.user)
        resp = self.client.get(reverse("protected-pdf-list"))
        titles = [r["title"] for r in resp.json()]
        self.assertIn("Medical Biochemistry", titles)
        self.assertNotIn("Staff Manual", titles)
