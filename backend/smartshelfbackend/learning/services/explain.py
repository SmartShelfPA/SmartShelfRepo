from __future__ import annotations

import html
import re
from typing import Any

import requests
from django.conf import settings


def _plain_text_from_html(fragment: str) -> str:
    if not fragment or not str(fragment).strip():
        return ""
    text = str(fragment)
    text = re.sub(r"<script[\s\S]*?</script>", "", text, flags=re.I)
    text = re.sub(r"<style[\s\S]*?</style>", "", text, flags=re.I)
    text = re.sub(r"<br\s*/?>", "\n", text, flags=re.I)
    text = re.sub(r"</p>", "\n", text, flags=re.I)
    text = re.sub(r"<[^>]+>", " ", text)
    text = html.unescape(text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def fetch_ai_answer_explanation(
    *,
    exam_type: str,
    subject: str,
    year: int,
    question: dict[str, Any],
) -> str:
    api_key = getattr(settings, "OPENAI_API_KEY", "") or ""
    if not api_key.strip():
        raise ValueError("OPENAI_API_KEY is not configured on the SmartShelf server.")

    model = getattr(settings, "OPENAI_EXPLAIN_MODEL", "gpt-4o-mini") or "gpt-4o-mini"
    prompt_plain = _plain_text_from_html(str(question.get("prompt_html") or ""))
    options = question.get("options") or []
    options_plain = []
    if isinstance(options, list):
        for opt in options:
            if not isinstance(opt, dict):
                continue
            oid = str(opt.get("id") or "?")
            label = _plain_text_from_html(str(opt.get("label_html") or ""))
            options_plain.append(f"{oid}) {label}")

    correct = str(question.get("correct_option_id") or "")
    bank_hint = _plain_text_from_html(str(question.get("explanation_html") or ""))

    user_block = "\n".join(
        [
            f"Exam: {exam_type}",
            f"Subject: {subject}",
            f"Year: {year}",
            "",
            "Question:",
            prompt_plain,
            "",
            "Options:",
            *options_plain,
            "",
            f"Correct option (verified): {correct}",
            f"\nOfficial / bundled solution (may be empty or partial): {bank_hint}"
            if bank_hint
            else "",
            "",
            "Write 3–6 short sentences explaining why the correct option is right. "
            "Be clear and exam-appropriate. Do not restate only the letter—justify the concept. "
            "If LaTeX appears, use plain words.",
        ]
    )

    response = requests.post(
        "https://api.openai.com/v1/chat/completions",
        headers={
            "Authorization": f"Bearer {api_key.strip()}",
            "Content-Type": "application/json",
        },
        json={
            "model": model,
            "temperature": 0.35,
            "max_tokens": 450,
            "messages": [
                {
                    "role": "system",
                    "content": (
                        "You are a helpful exam tutor. Answer concisely in plain text "
                        "(no markdown headings). No unsupported claims."
                    ),
                },
                {"role": "user", "content": user_block},
            ],
        },
        timeout=float(getattr(settings, "OPENAI_REQUEST_TIMEOUT", 30)),
    )
    data = response.json()
    if not response.ok:
        err = data.get("error", {}) if isinstance(data, dict) else {}
        message = err.get("message") if isinstance(err, dict) else None
        raise ValueError(message or f"OpenAI request failed ({response.status_code})")

    choices = data.get("choices") if isinstance(data, dict) else None
    if not isinstance(choices, list) or not choices:
        raise ValueError("No explanation text returned from the model.")
    first = choices[0] if isinstance(choices[0], dict) else {}
    message = first.get("message") if isinstance(first.get("message"), dict) else {}
    text = str(message.get("content") or "").strip()
    if not text:
        raise ValueError("No explanation text returned from the model.")
    return text
