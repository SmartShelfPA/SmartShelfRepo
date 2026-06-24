from __future__ import annotations

from django.conf import settings
from django.utils import timezone

from learning.models import QuestionCacheBatch
from learning.services.normalize import normalize_question
from learning.services.providers.aloc import AlocQuestionProvider
from learning.services.providers.aloc_errors import AlocProviderError


def get_provider_for_exam(exam_type: str) -> AlocQuestionProvider:
    """WAEC/JAMB practice questions are sourced from the ALOC adapter."""
    _ = exam_type
    return AlocQuestionProvider()


def fetch_normalized_questions(*, exam_type: str, subject: str, year: int) -> list[dict]:
    ttl = int(getattr(settings, "QUESTION_CACHE_TTL_SECONDS", 3600))
    provider = get_provider_for_exam(exam_type)
    batch_key = QuestionCacheBatch.make_batch_key(provider.name, exam_type, subject, year)
    now = timezone.now()
    batch = QuestionCacheBatch.objects.filter(batch_key=batch_key, expires_at__gt=now).first()
    if batch and isinstance(batch.questions_json, list) and batch.questions_json:
        return batch.questions_json

    raw_items = provider.fetch_questions(exam_type=exam_type, subject=subject, year=year)
    normalized: list[dict] = []
    for idx, raw in enumerate(raw_items):
        normalized.append(
            normalize_question(
                exam_type=exam_type,
                subject=subject,
                year=year,
                order_index=idx,
                raw=raw if isinstance(raw, dict) else {},
                provider=provider.name,
            )
        )

    if not normalized:
        raise AlocProviderError(
            f"No questions could be normalized for {exam_type} / {subject} / {year}."
        )

    QuestionCacheBatch.objects.update_or_create(
        batch_key=batch_key,
        defaults={
            "provider": provider.name,
            "exam_type": exam_type,
            "subject": subject,
            "year": year,
            "questions_json": normalized,
            "expires_at": now + timezone.timedelta(seconds=ttl),
        },
    )
    return normalized


def default_subjects_for_exam(exam_type: str) -> list[str]:
    """Static fallbacks when upstream subject discovery is unavailable."""
    et = exam_type.upper()
    if et == "JAMB":
        return ["english", "mathematics", "physics", "chemistry", "biology"]
    return ["mathematics", "english", "physics", "chemistry", "economics"]


def default_years() -> list[int]:
    y = timezone.now().year
    return [y, y - 1, y - 2, y - 3]
