from __future__ import annotations

import html
import re
from typing import Any

_DIAGRAM_MAX = 8000
_EMPTY_DIAGRAM = {"", "null", "none", "n/a", "nil", "undefined"}
_UNSAFE_SVG = re.compile(r"<script|javascript:|on\w+\s*=", re.IGNORECASE)
_IMG_SRC = re.compile(r"""<img\b[^>]*\ssrc=["']([^"']+)["']""", re.IGNORECASE)


def clean_diagram(value: object) -> str:
    """Keep a remote figure, a data-uri image, or a plain SVG diagram."""
    if not isinstance(value, str):
        return ""
    raw = value.strip()
    if not raw or raw.lower() in _EMPTY_DIAGRAM:
        return ""
    if raw.lower().startswith("<svg") and raw.lower().endswith("</svg>") and len(raw) <= _DIAGRAM_MAX:
        if _UNSAFE_SVG.search(raw):
            return ""
        return raw
    if raw.startswith("//"):
        raw = f"https:{raw}"
    if re.match(r"^https?://", raw, re.IGNORECASE) and len(raw) <= 2000:
        return raw
    if raw.lower().startswith("data:image/") and len(raw) <= _DIAGRAM_MAX:
        return raw
    return ""


def _diagram_from_raw(raw: dict[str, Any], prompt_html: str) -> str:
    for key in ("diagram_url", "diagramUrl", "image", "image_url", "imageUrl", "figure"):
        found = clean_diagram(raw.get(key))
        if found:
            return found
    match = _IMG_SRC.search(prompt_html or "")
    if match:
        return clean_diagram(match.group(1))
    return ""


def _year_from_raw(raw: dict[str, Any], fallback: int) -> int:
    for key in ("year", "examyear", "exam_year"):
        value = raw.get(key)
        if value is None or value == "":
            continue
        try:
            year = int(value)
        except (TypeError, ValueError):
            continue
        if 1980 <= year <= 2100:
            return year
    return fallback


def normalize_html_fragment(text: str | None) -> str:
    """Expose HTML fragment coercion for adapters (revision notes / theory prompts)."""
    return _html_fragment(text)


def _html_fragment(text: str | None) -> str:
    if not text:
        return "<p></p>"
    s = str(text).strip()
    if not s:
        return "<p></p>"
    if "<" in s and ">" in s:
        return s
    escaped = html.escape(s)
    return f"<p>{escaped}</p>"


def normalize_question(
    *,
    exam_type: str,
    subject: str,
    year: int,
    order_index: int,
    raw: dict[str, Any],
    provider: str,
) -> dict[str, Any]:
    """
    Produce the canonical SmartShelf question dict consumed by the mobile client.
    Keys use snake_case; serializers may alias to camelCase if needed.
    """
    qid = (
        raw.get("id")
        or raw.get("uuid")
        or raw.get("question_id")
        or raw.get("pk")
        or f"{provider}-{exam_type}-{subject}-{year}-{order_index}"
    )
    qid = str(qid)

    prompt_html = (
        raw.get("prompt_html")
        or raw.get("question_html")
        or raw.get("question")
        or raw.get("text")
        or raw.get("questionText")
        or ""
    )
    if isinstance(prompt_html, dict):
        prompt_html = str(prompt_html)

    options_in = raw.get("options") or raw.get("choices") or raw.get("answers")
    options: list[dict[str, str]] = []

    if isinstance(options_in, list):
        for idx, item in enumerate(options_in):
            if isinstance(item, dict):
                oid = str(item.get("id") or item.get("key") or item.get("option") or chr(65 + idx))
                label = (
                    item.get("label_html")
                    or item.get("labelHtml")
                    or item.get("text_html")
                    or item.get("text")
                    or item.get("label")
                    or ""
                )
            else:
                oid = chr(65 + idx)
                label = item
            options.append({"id": oid, "label_html": _html_fragment(str(label))})
    elif isinstance(options_in, dict):
        for k, v in options_in.items():
            options.append({"id": str(k), "label_html": _html_fragment(str(v))})

    if not options:
        for letter in ["A", "B", "C", "D"]:
            options.append({"id": letter, "label_html": f"<p>{letter}</p>"})

    correct_raw = (
        raw.get("correct_option_id")
        or raw.get("answer")
        or raw.get("correct")
        or raw.get("scheme")
    )
    correct_option_id = str(correct_raw).strip() if correct_raw is not None else options[0]["id"]
    if len(correct_option_id) == 1 and correct_option_id.isalpha():
        correct_option_id = correct_option_id.upper()
    if not any(o["id"] == correct_option_id for o in options):
        correct_option_id = options[0]["id"]

    explanation = (
        raw.get("explanation_html")
        or raw.get("explanation")
        or raw.get("solution")
        or raw.get("explanation_text")
        or ""
    )
    prompt = _html_fragment(str(prompt_html))

    return {
        "id": qid,
        "exam_type": exam_type,
        "subject": subject,
        "year": _year_from_raw(raw, year),
        "prompt_html": prompt,
        "diagram_url": _diagram_from_raw(raw, prompt),
        "options": options,
        "correct_option_id": correct_option_id,
        "explanation_html": _html_fragment(str(explanation)) if explanation else "",
        "order_index": order_index,
        "source": {"provider": provider, "raw_keys": list(raw.keys())[:40]},
    }
