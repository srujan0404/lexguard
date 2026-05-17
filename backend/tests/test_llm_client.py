from __future__ import annotations

import pytest

from app.config import Settings
from app.core.errors import LLMError
from app.llm.client import LLMClient, _parse_json


def _client() -> LLMClient:
    return LLMClient(
        Settings(
            LLM_BACKEND="aistudio",
            GEMINI_API_KEY="test-key",
            APP_ENV="dev",
        )
    )


@pytest.mark.parametrize(
    "raw, expected",
    [
        ('{"ok": true}', {"ok": True}),
        ('```json\n{"ok": true}\n```', {"ok": True}),
        ('```\n{"ok": true}\n```', {"ok": True}),
        ('Sure, here you go:\n{"ok": true}\nLet me know!', {"ok": True}),
        ('{"nested": {"a": [1, 2, 3]}}', {"nested": {"a": [1, 2, 3]}}),
    ],
)
def test_parse_json_handles_fences_and_prose(raw: str, expected: dict) -> None:
    assert _parse_json(raw) == expected


@pytest.mark.parametrize("raw", ["", "   ", "no json here at all"])
def test_parse_json_raises_on_invalid(raw: str) -> None:
    with pytest.raises(LLMError):
        _parse_json(raw)


async def test_generate_json_uses_generate_raw(monkeypatch: pytest.MonkeyPatch) -> None:
    client = _client()
    captured: dict = {}

    def fake_sync(system, user, *, heavy, temperature, max_output_tokens, json_mode):
        captured.update(
            system=system,
            user=user,
            heavy=heavy,
            temperature=temperature,
            max_output_tokens=max_output_tokens,
            json_mode=json_mode,
        )
        return '{"verdict": "ok", "score": 42}'

    monkeypatch.setattr(client, "_generate_raw_sync", fake_sync)
    client._client = object()  # bypass lazy SDK init

    result = await client.generate_json("sys", "user")
    assert result == {"verdict": "ok", "score": 42}
    assert captured["json_mode"] is True
    assert captured["heavy"] is False


async def test_generate_text_passes_through(monkeypatch: pytest.MonkeyPatch) -> None:
    client = _client()

    def fake_sync(*args, **kwargs):
        return "hello"

    monkeypatch.setattr(client, "_generate_raw_sync", fake_sync)
    client._client = object()  # bypass lazy SDK init

    assert await client.generate_text("sys", "user") == "hello"


async def test_generate_json_propagates_llm_error(monkeypatch: pytest.MonkeyPatch) -> None:
    client = _client()

    def boom(*args, **kwargs):
        raise RuntimeError("network down")

    monkeypatch.setattr(client, "_generate_raw_sync", boom)
    client._client = object()  # bypass lazy SDK init

    with pytest.raises(LLMError):
        await client.generate_json("sys", "user")


def test_aistudio_backend_requires_api_key() -> None:
    client = LLMClient(Settings(LLM_BACKEND="aistudio", GEMINI_API_KEY=""))
    with pytest.raises(LLMError):
        client._ensure_client()


def test_vertex_backend_requires_project() -> None:
    client = LLMClient(Settings(LLM_BACKEND="vertex", GCP_PROJECT_ID=""))
    with pytest.raises(LLMError):
        client._ensure_client()
