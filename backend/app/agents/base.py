from __future__ import annotations

from typing import Any, ClassVar

from pydantic import ValidationError

from app.core.errors import AnalysisError
from app.llm import LLMClient, get_llm


class BaseAgent:
    name: ClassVar[str]
    system_prompt: ClassVar[str]
    heavy: ClassVar[bool] = False

    def __init__(self, llm: LLMClient | None = None) -> None:
        self._llm = llm or get_llm()

    async def _call(
        self, user_prompt: str, *, temperature: float = 0.2, max_output_tokens: int = 4096
    ) -> dict[str, Any]:
        return await self._llm.generate_json(
            self.system_prompt,
            user_prompt,
            heavy=self.heavy,
            temperature=temperature,
            max_output_tokens=max_output_tokens,
        )

    def _validate_each[T](self, raw: list[dict[str, Any]], model: type[T]) -> list[T]:
        validated: list[T] = []
        for i, item in enumerate(raw):
            try:
                validated.append(model(**item))  # type: ignore[call-arg]
            except ValidationError as exc:
                raise AnalysisError(
                    f"{self.name}: item {i} failed schema validation: {exc.errors()}"
                ) from exc
        return validated
