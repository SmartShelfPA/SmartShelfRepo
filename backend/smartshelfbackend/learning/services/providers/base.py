from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any


class BaseQuestionProvider(ABC):
    name: str = "base"

    @abstractmethod
    def fetch_questions(
        self,
        *,
        exam_type: str,
        subject: str,
        year: int,
    ) -> list[dict[str, Any]]:
        """Return provider-native question dicts (before normalization)."""
