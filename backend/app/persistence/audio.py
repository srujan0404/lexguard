from __future__ import annotations

import asyncio
import hashlib
import logging
from functools import lru_cache
from typing import Any

from app.config import Settings, get_settings

log = logging.getLogger(__name__)

VOICE_BY_LANG = {
    "en": ("en-IN", "en-IN-Neural2-A"),
    "hinglish": ("hi-IN", "hi-IN-Neural2-A"),
    "hi": ("hi-IN", "hi-IN-Neural2-A"),
}


def _bucket_name(project_id: str) -> str:
    return f"lexguard-cache-{project_id}"


def _object_key(document_id: str, lang: str, text: str) -> str:
    digest = hashlib.sha256(text.encode("utf-8")).hexdigest()[:10]
    return f"audio/{document_id}-{lang}-{digest}.mp3"


class AudioStore:
    """Synthesizes scorecard summaries via Cloud TTS and caches MP3s in GCS."""

    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._storage_client: Any = None
        self._tts_client: Any = None
        self._enabled: bool | None = None

    @property
    def enabled(self) -> bool:
        if self._enabled is not None:
            return self._enabled
        if not self._settings.GCP_PROJECT_ID:
            self._enabled = False
            return False
        try:
            from google.cloud import storage, texttospeech

            self._storage_client = storage.Client(project=self._settings.GCP_PROJECT_ID)
            self._tts_client = texttospeech.TextToSpeechClient()
            self._enabled = True
        except Exception as exc:
            log.warning("audio_store_unavailable", extra={"error": str(exc)})
            self._enabled = False
        return self._enabled

    async def get_or_synthesize(
        self, document_id: str, text: str, lang: str
    ) -> bytes | None:
        if not self.enabled or not text:
            return None
        if lang not in VOICE_BY_LANG:
            lang = "en"

        key = _object_key(document_id, lang, text)
        bucket = self._storage_client.bucket(_bucket_name(self._settings.GCP_PROJECT_ID))

        cached = await asyncio.to_thread(self._read_cache, bucket, key)
        if cached is not None:
            log.info("audio_cache_hit", extra={"document_id": document_id, "lang": lang})
            return cached

        try:
            audio = await asyncio.to_thread(self._synthesize, text, lang)
        except Exception as exc:
            log.warning(
                "tts_synthesis_failed",
                extra={"document_id": document_id, "error": str(exc)},
            )
            return None

        # Cache for next request - bucket lifecycle handles the 1h auto-delete.
        await asyncio.to_thread(self._write_cache, bucket, key, audio)
        log.info(
            "audio_cache_miss",
            extra={
                "document_id": document_id,
                "lang": lang,
                "bytes": len(audio),
                "key": key,
            },
        )
        return audio

    def _read_cache(self, bucket: Any, key: str) -> bytes | None:
        blob = bucket.blob(key)
        try:
            if not blob.exists():
                return None
            return blob.download_as_bytes()
        except Exception as exc:
            log.warning("audio_cache_read_failed", extra={"error": str(exc)})
            return None

    def _write_cache(self, bucket: Any, key: str, data: bytes) -> None:
        blob = bucket.blob(key)
        try:
            blob.upload_from_string(data, content_type="audio/mpeg")
        except Exception as exc:
            log.warning("audio_cache_write_failed", extra={"error": str(exc)})

    def _synthesize(self, text: str, lang: str) -> bytes:
        from google.cloud import texttospeech

        language_code, voice_name = VOICE_BY_LANG[lang]
        synthesis_input = texttospeech.SynthesisInput(text=text)
        voice = texttospeech.VoiceSelectionParams(
            language_code=language_code,
            name=voice_name,
        )
        audio_config = texttospeech.AudioConfig(
            audio_encoding=texttospeech.AudioEncoding.MP3,
            speaking_rate=0.96,
            pitch=-1.0,
        )
        response = self._tts_client.synthesize_speech(
            input=synthesis_input,
            voice=voice,
            audio_config=audio_config,
        )
        return response.audio_content


@lru_cache(maxsize=1)
def get_audio_store() -> AudioStore:
    return AudioStore(get_settings())
