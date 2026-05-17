from __future__ import annotations

import asyncio
import json
import logging
import re
from functools import lru_cache
from typing import Any

from tenacity import (
    RetryError,
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
)

from app.config import Settings, get_settings
from app.core.errors import LLMError

log = logging.getLogger(__name__)

_FENCE_RE = re.compile(r"^```(?:json)?\s*|\s*```$", re.IGNORECASE | re.MULTILINE)
_FIRST_OBJECT_RE = re.compile(r"\{.*\}", re.DOTALL)


class LLMClient:
    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._client: Any = None
        self._types: Any = None

    def _model_name(self, *, heavy: bool) -> str:
        return self._settings.GEMINI_MODEL_HEAVY if heavy else self._settings.GEMINI_MODEL

    def _ensure_client(self) -> None:
        if self._client is not None:
            return
        from google import genai
        from google.genai import types

        backend = self._settings.LLM_BACKEND
        if backend == "vertex":
            if not self._settings.GCP_PROJECT_ID:
                raise LLMError("GCP_PROJECT_ID is required when LLM_BACKEND=vertex.")
            self._client = genai.Client(
                vertexai=True,
                project=self._settings.GCP_PROJECT_ID,
                location=self._settings.GCP_REGION,
            )
        elif backend == "aistudio":
            if not self._settings.GEMINI_API_KEY:
                raise LLMError("GEMINI_API_KEY is required when LLM_BACKEND=aistudio.")
            self._client = genai.Client(api_key=self._settings.GEMINI_API_KEY)
        else:
            raise LLMError(f"Unknown LLM_BACKEND: {backend}")
        self._types = types

    def _generate_raw_sync(
        self,
        system: str,
        user: str,
        *,
        heavy: bool,
        temperature: float,
        max_output_tokens: int,
        json_mode: bool,
    ) -> str:
        self._ensure_client()
        types = self._types
        config_kwargs: dict[str, Any] = {
            "system_instruction": system,
            "temperature": temperature,
            "max_output_tokens": max_output_tokens,
            "thinking_config": types.ThinkingConfig(thinking_budget=0),
        }
        if json_mode:
            config_kwargs["response_mime_type"] = "application/json"

        response = self._client.models.generate_content(
            model=self._model_name(heavy=heavy),
            contents=user,
            config=types.GenerateContentConfig(**config_kwargs),
        )
        return _extract_text_or_raise(response, max_output_tokens)

    @retry(
        reraise=True,
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=1, max=8),
        retry=retry_if_exception_type(LLMError),
    )
    async def _generate_raw(
        self,
        system: str,
        user: str,
        *,
        heavy: bool,
        temperature: float,
        max_output_tokens: int,
        json_mode: bool,
    ) -> str:
        try:
            return await asyncio.to_thread(
                self._generate_raw_sync,
                system,
                user,
                heavy=heavy,
                temperature=temperature,
                max_output_tokens=max_output_tokens,
                json_mode=json_mode,
            )
        except LLMError:
            raise
        except Exception as exc:
            log.warning("llm_call_failed", extra={"backend": self._settings.LLM_BACKEND})
            raise LLMError(f"Gemini call failed: {exc}") from exc

    async def generate_text(
        self,
        system: str,
        user: str,
        *,
        heavy: bool = False,
        temperature: float = 0.3,
        max_output_tokens: int = 4096,
    ) -> str:
        return await self._generate_raw(
            system,
            user,
            heavy=heavy,
            temperature=temperature,
            max_output_tokens=max_output_tokens,
            json_mode=False,
        )

    async def generate_json(
        self,
        system: str,
        user: str,
        *,
        heavy: bool = False,
        temperature: float = 0.2,
        max_output_tokens: int = 8192,
    ) -> dict[str, Any]:
        try:
            raw = await self._generate_raw(
                system,
                user,
                heavy=heavy,
                temperature=temperature,
                max_output_tokens=max_output_tokens,
                json_mode=True,
            )
        except RetryError as exc:
            raise LLMError("Exhausted retries calling Gemini.") from exc
        return _parse_json(raw)


def _parse_json(raw: str) -> dict[str, Any]:
    if not raw:
        raise LLMError("Gemini returned an empty response.")
    cleaned = _FENCE_RE.sub("", raw).strip()
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        match = _FIRST_OBJECT_RE.search(cleaned)
        if not match:
            raise LLMError(
                "Gemini response was not valid JSON.",
                details={"snippet": cleaned[:400]},
            ) from None
        try:
            return json.loads(match.group(0))
        except json.JSONDecodeError as exc:
            raise LLMError(
                "Gemini response was not valid JSON after extraction (likely truncated).",
                details={"snippet": cleaned[-400:], "json_error": str(exc)},
            ) from exc


def _extract_text_or_raise(response: Any, requested_tokens: int) -> str:
    candidates = getattr(response, "candidates", None) or []
    finish_reason = getattr(candidates[0], "finish_reason", None) if candidates else None
    usage = getattr(response, "usage_metadata", None)
    text = getattr(response, "text", None)

    finish_name = getattr(finish_reason, "name", None) or str(finish_reason or "")
    if finish_name == "MAX_TOKENS":
        used = getattr(usage, "total_token_count", None) if usage else None
        raise LLMError(
            "Gemini hit max_output_tokens. Bump the budget for this agent.",
            details={
                "requested": requested_tokens,
                "used": used,
                "partial": (text or "")[:400],
            },
        )

    if not text:
        raise LLMError(
            "Gemini returned no text.",
            details={"finish_reason": finish_name},
        )
    return text


@lru_cache(maxsize=1)
def get_llm() -> LLMClient:
    return LLMClient(get_settings())
