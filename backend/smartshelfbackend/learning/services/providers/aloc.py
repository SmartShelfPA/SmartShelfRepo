from __future__ import annotations

import logging
import time
from typing import Any

import requests
from django.conf import settings

from learning.services.providers.aloc_errors import AlocProviderError
from learning.services.providers.base import BaseQuestionProvider

logger = logging.getLogger(__name__)

SESSION_TARGET = 10
MAX_Q_FETCH_ATTEMPTS = 20
Q_FETCH_GAP_SEC = 0.05


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
            h["AccessToken"] = self.token
        return h

    def _exam_param(self, exam_type: str) -> str:
        et = exam_type.upper()
        if et == "WAEC":
            return self.type_waec
        if et == "JAMB":
            return self.type_jamb
        return self.type_jamb

    def _read_error_message(self, data: Any, status: int) -> str:
        if isinstance(data, dict):
            for key in ("error", "detail", "message"):
                val = data.get(key)
                if isinstance(val, str) and val.strip():
                    return val.strip()
        return f"ALOC request failed (HTTP {status})"

    def _request_json(self, path: str, params: dict[str, Any]) -> Any:
        if not self.token.strip():
            raise AlocProviderError(
                "ALOC_ACCESS_TOKEN is not set on the SmartShelf server. "
                "For local Docker use ALOC_ACCESS_TOKEN=smartshelf-dev-token with the bundled ALOC service."
            )

        url = f"{self.base_url}{path}"
        try:
            resp = requests.get(
                url, params=params, headers=self._headers(), timeout=self.timeout
            )
        except requests.RequestException as exc:
            logger.warning("ALOC network error %s: %s", url, exc)
            raise AlocProviderError(f"Could not reach ALOC at {self.base_url}.") from exc

        try:
            data = resp.json()
        except ValueError:
            data = None

        if not resp.ok:
            msg = self._read_error_message(data, resp.status_code)
            raise AlocProviderError(msg)

        return data

    def _flatten_payload(self, data: Any) -> list[dict[str, Any]]:
        if isinstance(data, list):
            return [x for x in data if isinstance(x, dict)]
        if isinstance(data, dict):
            inner = data.get("data")
            if isinstance(inner, list):
                return [x for x in inner if isinstance(x, dict)]
            if isinstance(inner, dict):
                return [inner]
            for key in ("questions", "items", "results", "payload"):
                nested = data.get(key)
                if isinstance(nested, list):
                    return [x for x in nested if isinstance(x, dict)]
            if all(isinstance(v, dict) for v in data.values()):
                return list(data.values())
        return []

    def _fetch_many(self, *, exam_type: str, subject: str, year: int) -> list[dict[str, Any]]:
        params: dict[str, Any] = {
            "subject": subject.lower(),
            "type": self._exam_param(exam_type),
        }
        if year and year > 0:
            params["year"] = year

        data = self._request_json("/m", params)
        flat = self._flatten_payload(data)
        return [AlocQuestionNormalizerMixin.to_generic(item, idx) for idx, item in enumerate(flat)]

    def _fetch_one_q(
        self, *, exam_type: str, subject: str, year: int
    ) -> dict[str, Any] | None:
        params: dict[str, Any] = {
            "subject": subject.lower(),
            "type": self._exam_param(exam_type),
        }
        if year and year > 0:
            params["year"] = year

        try:
            data = self._request_json("/q", params)
        except AlocProviderError:
            return None

        flat = self._flatten_payload(data)
        if not flat:
            return None
        return AlocQuestionNormalizerMixin.to_generic(flat[0], 0)

    def _pump_single_questions(
        self, *, exam_type: str, subject: str, year: int, target: int
    ) -> list[dict[str, Any]]:
        seen: set[str] = set()
        collected: list[dict[str, Any]] = []
        attempts = 0

        while len(collected) < target and attempts < MAX_Q_FETCH_ATTEMPTS:
            attempts += 1
            item = self._fetch_one_q(exam_type=exam_type, subject=subject, year=year)
            if item:
                qid = str(item.get("id") or "")
                if qid and qid not in seen:
                    seen.add(qid)
                    collected.append(item)
            if len(collected) < target and attempts < MAX_Q_FETCH_ATTEMPTS:
                time.sleep(Q_FETCH_GAP_SEC)

        return collected

    def fetch_questions(
        self,
        *,
        exam_type: str,
        subject: str,
        year: int,
    ) -> list[dict[str, Any]]:
        bulk: list[dict[str, Any]] = []
        try:
            bulk = self._fetch_many(exam_type=exam_type, subject=subject, year=year)
        except AlocProviderError as exc:
            logger.warning("ALOC /m failed for %s/%s/%s: %s", exam_type, subject, year, exc)

        if not bulk:
            try:
                bulk = self._fetch_many(exam_type=exam_type, subject=subject, year=0)
            except AlocProviderError as exc:
                logger.warning("ALOC /m (any year) failed: %s", exc)

        # /q is one HTTP round-trip per question (~15s on local ALOC); only use when /m is empty.
        if not bulk:
            bulk = self._pump_single_questions(
                exam_type=exam_type,
                subject=subject,
                year=0,
                target=SESSION_TARGET,
            )

        if not bulk:
            raise AlocProviderError(
                f"No questions returned for {exam_type} / {subject} / {year}. "
                "Check ALOC_ACCESS_TOKEN and ALOC_API_BASE_URL on the server."
            )

        return bulk[:40]


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
            or aloc_item.get("solution")
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
        if isinstance(correct, str) and correct.strip():
            stripped = correct.strip()
            if len(stripped) == 1 and stripped.isalpha():
                correct_id = stripped.upper()
            elif stripped.lower().startswith("option "):
                letter = stripped.split()[-1]
                if len(letter) == 1 and letter.isalpha():
                    correct_id = letter.upper()
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
