from __future__ import annotations

import logging
from typing import Any

import requests
from django.conf import settings

from learning.services.providers.base import BaseQuestionProvider

logger = logging.getLogger(__name__)


class AlocQuestionProvider(BaseQuestionProvider):
    """
    Adapter for the ALOC Questions API ([aloc-endpoints](https://github.com/Seunope/aloc-endpoints)).
    Hosted API examples: https://questions.aloc.com.ng/api/v2/
    """

    name = "aloc"

    def __init__(self) -> None:
        self.base_url = getattr(
            settings,
            "ALOC_API_BASE_URL",
            "https://questions.aloc.com.ng/api/v2",
        ).rstrip("/")
        self.token = getattr(settings, "ALOC_ACCESS_TOKEN", "") or ""
        self.timeout = float(getattr(settings, "ALOC_REQUEST_TIMEOUT", 15))
        self.type_waec = getattr(settings, "ALOC_EXAM_TYPE_WAEC", "wassce")
        self.type_jamb = getattr(settings, "ALOC_EXAM_TYPE_JAMB", "utme")

    def _headers(self) -> dict[str, str]:
        h = {"Accept": "application/json"}
        if self.token:
            h["Authorization"] = f"Bearer {self.token}"
        return h

    def _exam_param(self, exam_type: str) -> str:
        et = exam_type.upper()
        if et == "WAEC":
            return self.type_waec
        if et == "JAMB":
            return self.type_jamb
        return self.type_jamb

    def fetch_questions(
        self,
        *,
        exam_type: str,
        subject: str,
        year: int,
    ) -> list[dict[str, Any]]:
        params: dict[str, Any] = {
            "subject": subject.lower(),
            "type": self._exam_param(exam_type),
        }
        if year and year > 0:
            params["year"] = year

        url = f"{self.base_url}/m"
        try:
            resp = requests.get(url, params=params, headers=self._headers(), timeout=self.timeout)
            resp.raise_for_status()
            data = resp.json()
        except Exception as exc:
            logger.warning("ALOC request failed: %s", exc)
            return []

        flat = self._flatten_payload(data)
        return [AlocQuestionNormalizerMixin.to_generic(item, idx) for idx, item in enumerate(flat)]

    def _flatten_payload(self, data: Any) -> list[dict[str, Any]]:
        if isinstance(data, list):
            return [x for x in data if isinstance(x, dict)]
        if isinstance(data, dict):
            for key in ("data", "questions", "items", "results", "payload"):
                inner = data.get(key)
                if isinstance(inner, list):
                    return [x for x in inner if isinstance(x, dict)]
            if all(isinstance(v, dict) for v in data.values()):
                return list(data.values())
        return []


class AlocQuestionNormalizerMixin:
    """Translate common ALOC fields into keys understood by learning.services.normalize."""

    @staticmethod
    def to_generic(aloc_item: dict[str, Any], index: int) -> dict[str, Any]:
        question_text = (
            aloc_item.get("question")
            or aloc_item.get("question_text")
            or aloc_item.get("body")
            or aloc_item.get("stem")
            or ""
        )
        opts = aloc_item.get("option") or aloc_item.get("options") or aloc_item.get("choices")
        option_list: list[str] = []
        if isinstance(opts, dict):
            for k in sorted(opts.keys()):
                option_list.append(str(opts[k]))
        elif isinstance(opts, list):
            option_list = [str(x) for x in opts]

        correct = aloc_item.get("answer") or aloc_item.get("correct") or aloc_item.get("solution")
        explanation = (
            aloc_item.get("explanation")
            or aloc_item.get("solution_detail")
            or aloc_item.get("detail")
            or ""
        )

        letters = ["A", "B", "C", "D", "E", "F"]
        options_out = []
        for i, text in enumerate(option_list[:6]):
            options_out.append(
                {
                    "id": letters[i] if i < len(letters) else str(i),
                    "label_html": f"<p>{text}</p>",
                }
            )

        correct_id = None
        if isinstance(correct, str) and len(correct.strip()) == 1:
            correct_id = correct.strip().upper()
        elif isinstance(correct, int):
            idx = int(correct)
            if 0 <= idx < len(letters):
                correct_id = letters[idx]

        qid = str(aloc_item.get("id") or aloc_item.get("question_id") or f"aloc-{index}")

        return {
            "id": qid,
            "question": question_text,
            "options": options_out,
            "correct": correct_id or (letters[0] if options_out else "A"),
            "explanation": explanation,
        }
