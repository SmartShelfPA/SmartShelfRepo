"""Who may open a school textbook once term licences exist."""

from __future__ import annotations

from django.db.models import Q
from django.utils import timezone

from .models import TextbookLicence


def licence_allows(user, asset) -> bool:
    """Students are blocked only when the book has licences and none match them today.

    Books with no licence rows stay visible, so existing school resources keep working.
    Teachers and other roles are not filtered here.
    """
    if getattr(user, "role", "") != "student":
        return True
    licences = TextbookLicence.objects.filter(asset_id=asset.pk)
    if not licences.exists():
        return True
    today = timezone.localdate()
    student_class = (getattr(user, "student_class", "") or "").strip()
    return licences.filter(
        Q(target_class="") | Q(target_class__iexact=student_class),
        starts_on__lte=today,
        ends_on__gte=today,
    ).exists()
