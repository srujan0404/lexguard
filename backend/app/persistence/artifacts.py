from __future__ import annotations

import contextlib
import logging
from datetime import UTC, datetime, timedelta
from functools import lru_cache
from typing import Any

from app.config import Settings, get_settings

log = logging.getLogger(__name__)

ARTIFACT_TTL_HOURS = 1


class ArtifactStore:
    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._client: Any = None
        self._enabled: bool | None = None

    @property
    def enabled(self) -> bool:
        if self._enabled is not None:
            return self._enabled
        if not self._settings.GCP_PROJECT_ID:
            self._enabled = False
            return False
        try:
            from google.cloud import firestore

            self._client = firestore.AsyncClient(project=self._settings.GCP_PROJECT_ID)
            self._enabled = True
        except Exception as exc:
            log.warning("artifact_store_unavailable", extra={"error": str(exc)})
            self._enabled = False
        return self._enabled

    async def put(self, document_id: str, artifacts: dict[str, Any]) -> None:
        if not self.enabled:
            return
        now = datetime.now(UTC)
        payload = {
            **artifacts,
            "document_id": document_id,
            "created_at": now,
            "expires_at": now + timedelta(hours=ARTIFACT_TTL_HOURS),
        }
        try:
            await self._client.collection("artifacts").document(document_id).set(payload)
        except Exception as exc:
            log.warning(
                "artifact_put_failed",
                extra={"document_id": document_id, "error": str(exc)},
            )

    async def get(self, document_id: str) -> dict[str, Any] | None:
        if not self.enabled:
            return None
        try:
            snap = await self._client.collection("artifacts").document(document_id).get()
        except Exception as exc:
            log.warning(
                "artifact_get_failed",
                extra={"document_id": document_id, "error": str(exc)},
            )
            return None
        if not snap.exists:
            return None
        data = snap.to_dict() or {}
        expires_at = data.get("expires_at")
        if expires_at and datetime.now(UTC) > expires_at:
            with contextlib.suppress(Exception):
                await snap.reference.delete()
            return None
        return data


@lru_cache(maxsize=1)
def get_artifact_store() -> ArtifactStore:
    return ArtifactStore(get_settings())
