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
        self._backend_ready = False
        self._aistudio: Any = None

    def _model_name(self, *, heavy: bool) -> str:
        return self._settings.GEMINI_MODEL_HEAVY if heavy else self._settings.GEMINI_MODEL

    def _ensure_backend(self) -> None:
        if self._backend_ready:
            return
        backend = self._settings.LLM_BACKEND
        if backend == "vertex":
            import vertexai

            if not self._settings.GCP_PROJECT_ID:
                raise LLMError("GCP_PROJECT_ID is required when LLM_BACKEND=vertex.")
            vertexai.init(
                project=self._settings.GCP_PROJECT_ID,
                location=self._settings.GCP_REGION,
            )
        elif backend == "aistudio":
            import google.generativeai as genai

            if not self._settings.GEMINI_API_KEY:
                raise LLMError("GEMINI_API_KEY is required when LLM_BACKEND=aistudio.")
            genai.configure(api_key=self._settings.GEMINI_API_KEY)
            self._aistudio = genai
        else:
            raise LLMError(f"Unknown LLM_BACKEND: {backend}")
        self._backend_ready = True

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
        self._ensure_backend()
        model_name = self._model_name(heavy=heavy)

        if self._settings.LLM_BACKEND == "vertex":
            from vertexai.generative_models import (
                GenerationConfig,
                GenerativeModel,
            )

            model = GenerativeModel(model_name, system_instruction=system)
            config = GenerationConfig(
                temperature=temperature,
                max_output_tokens=max_output_tokens,
                response_mime_type="application/json" if json_mode else None,
            )
            response = model.generate_content(user, generation_config=config)
            return _extract_text_or_raise(response, max_output_tokens)

        genai = self._aistudio
        config: dict[str, Any] = {
            "temperature": temperature,
            "max_output_tokens": max_output_tokens,
        }
        if json_mode:
            config["response_mime_type"] = "application/json"
        model = genai.GenerativeModel(model_name, system_instruction=system)
        response = model.generate_content(user, generation_config=config)
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
        max_output_tokens: int = 16384,
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

    if finish_reason and int(finish_reason) == 2:
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
            details={"finish_reason": int(finish_reason) if finish_reason else None},
        )
    return text


@lru_cache(maxsize=1)
def get_llm() -> LLMClient:
    return LLMClient(get_settings())
