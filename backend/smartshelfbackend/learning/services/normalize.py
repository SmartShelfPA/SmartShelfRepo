from __future__ import annotations

import html
from typing import Any

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
    correct_option_id = str(correct_raw) if correct_raw is not None else options[0]["id"]
    if not any(o["id"] == correct_option_id for o in options):
        correct_option_id = options[0]["id"]

    explanation = (
        raw.get("explanation_html")
        or raw.get("explanation")
        or raw.get("solution")
        or raw.get("explanation_text")
        or ""
    )

    return {
        "id": qid,
        "exam_type": exam_type,
        "subject": subject,
        "year": year,
        "prompt_html": _html_fragment(str(prompt_html)),
        "options": options,
        "correct_option_id": correct_option_id,
        "explanation_html": _html_fragment(str(explanation)) if explanation else "",
        "order_index": order_index,
        "source": {"provider": provider, "raw_keys": list(raw.keys())[:40]},
    }
