from __future__ import annotations

import logging
import uuid
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, HTTPException

from app.persistence.risk_memory import get_repo
from app.schemas import DocumentScorecard

router = APIRouter(prefix="/api/v1/reports", tags=["reports"])
log = logging.getLogger(__name__)

TTL_HOURS = 24


@router.post(
    "",
    response_model=dict,
    summary="Save a scorecard for shareable retrieval via /r/{id}",
)
async def create_report(scorecard: DocumentScorecard) -> dict[str, str]:
    repo = get_repo()
    if not repo.enabled:
        raise HTTPException(status_code=503, detail="Persistence is not configured.")
    report_id = uuid.uuid4().hex[:10]
    now = datetime.now(UTC)
    await repo._client.collection("reports").document(report_id).set(
        {
            "scorecard": scorecard.model_dump(mode="json"),
            "created_at": now,
            "expires_at": now + timedelta(hours=TTL_HOURS),
        }
    )
    log.info("report_created", extra={"report_id": report_id})
    return {"id": report_id}


@router.get(
    "/{report_id}",
    response_model=DocumentScorecard,
    summary="Fetch a saved scorecard by ID",
)
async def get_report(report_id: str) -> DocumentScorecard:
    repo = get_repo()
    if not repo.enabled:
        raise HTTPException(status_code=503, detail="Persistence is not configured.")
    snap = await repo._client.collection("reports").document(report_id).get()
    if not snap.exists:
        raise HTTPException(status_code=404, detail="Report not found.")
    data = snap.to_dict() or {}
    expires_at = data.get("expires_at")
    if expires_at and datetime.now(UTC) > expires_at:
        await snap.reference.delete()
        raise HTTPException(status_code=404, detail="Report has expired.")
    return DocumentScorecard(**data["scorecard"])
