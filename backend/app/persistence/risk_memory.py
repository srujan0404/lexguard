from __future__ import annotations

import hashlib
import logging
import re
from dataclasses import dataclass
from datetime import UTC, datetime
from functools import lru_cache
from typing import Any

from app.config import Settings, get_settings

log = logging.getLogger(__name__)

_WS = re.compile(r"\s+")
_PUNCT = re.compile(r"[^a-z0-9 ]+")


@dataclass(frozen=True)
class ClauseRecord:
    clause_id: str
    text: str


@dataclass(frozen=True)
class ScanContext:
    doc_hash: str
    clause_hashes: dict[str, str]  # clause_id -> hash


@dataclass(frozen=True)
class ScanLookup:
    doc_seen_before: int
    clause_seen_in_n_others: dict[str, int]


def normalize(text: str) -> str:
    lowered = text.lower()
    no_punct = _PUNCT.sub(" ", lowered)
    return _WS.sub(" ", no_punct).strip()


def doc_hash(text: str) -> str:
    return hashlib.sha256(normalize(text).encode("utf-8")).hexdigest()[:16]


def clause_hash(text: str) -> str:
    return hashlib.sha256(normalize(text).encode("utf-8")).hexdigest()[:16]


class RiskMemoryRepo:
    """Firestore-backed scan + clause counter. Safe to ignore if disabled."""

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
            log.warning("firestore_unavailable", extra={"error": str(exc)})
            self._enabled = False
        return self._enabled

    async def lookup(self, ctx: ScanContext) -> ScanLookup:
        if not self.enabled:
            return ScanLookup(doc_seen_before=0, clause_seen_in_n_others={})

        doc_ref = self._client.collection("scans").document(ctx.doc_hash)
        try:
            doc_snap = await doc_ref.get()
            doc_seen_before = int(doc_snap.to_dict().get("count", 0)) if doc_snap.exists else 0
        except Exception as exc:
            log.warning("firestore_doc_lookup_failed", extra={"error": str(exc)})
            doc_seen_before = 0

        per_clause: dict[str, int] = {}
        for clause_id, c_hash in ctx.clause_hashes.items():
            try:
                snap = await self._client.collection("clauses").document(c_hash).get()
                per_clause[clause_id] = int(snap.to_dict().get("count", 0)) if snap.exists else 0
            except Exception as exc:
                log.warning("firestore_clause_lookup_failed", extra={"error": str(exc)})
                per_clause[clause_id] = 0
        return ScanLookup(doc_seen_before=doc_seen_before, clause_seen_in_n_others=per_clause)

    async def record(
        self,
        ctx: ScanContext,
        *,
        domain: str,
        risk_score: int,
        issuer_name: str | None,
    ) -> None:
        if not self.enabled:
            return
        from google.cloud import firestore

        now = datetime.now(UTC)
        try:
            await self._client.collection("scans").document(ctx.doc_hash).set(
                {
                    "count": firestore.Increment(1),
                    "last_seen": now,
                    "domain": domain,
                    "risk_score": risk_score,
                    "issuer_name": issuer_name,
                },
                merge=True,
            )
        except Exception as exc:
            log.warning("firestore_doc_record_failed", extra={"error": str(exc)})

        for c_hash in ctx.clause_hashes.values():
            try:
                payload: dict[str, Any] = {
                    "count": firestore.Increment(1),
                    "last_seen": now,
                }
                if issuer_name:
                    payload["issuers"] = firestore.ArrayUnion([issuer_name])
                if domain:
                    payload["domains"] = firestore.ArrayUnion([domain])
                await self._client.collection("clauses").document(c_hash).set(
                    payload, merge=True
                )
            except Exception as exc:
                log.warning("firestore_clause_record_failed", extra={"error": str(exc)})


@lru_cache(maxsize=1)
def get_repo() -> RiskMemoryRepo:
    return RiskMemoryRepo(get_settings())
