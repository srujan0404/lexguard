from __future__ import annotations

import logging
import re

from fastapi import APIRouter, HTTPException

from app.agents.chat import ChatAgent
from app.persistence.artifacts import get_artifact_store
from app.schemas import FollowupRequest, FollowupResponse, SuggestionsResponse

router = APIRouter(prefix="/api/v1/scans", tags=["chat"])
log = logging.getLogger(__name__)

_CLAUSE_ID_RE = re.compile(r"\bc\d+\b")
_NOT_FOUND = "Scan not found or its 1-hour artifact window has expired. Re-scan the document to ask follow-up questions."


@router.get(
    "/{document_id}/suggestions",
    response_model=SuggestionsResponse,
    summary="Get the Judge agent's suggested follow-up questions",
)
async def get_suggestions(document_id: str) -> SuggestionsResponse:
    artifacts = await get_artifact_store().get(document_id)
    if not artifacts:
        raise HTTPException(status_code=404, detail=_NOT_FOUND)
    return SuggestionsResponse(
        document_id=document_id,
        suggestions=list(artifacts.get("suggested_questions", []))[:3],
    )


@router.post(
    "/{document_id}/followup",
    response_model=FollowupResponse,
    summary="Ask a follow-up question grounded in the prior scan",
)
async def followup(document_id: str, req: FollowupRequest) -> FollowupResponse:
    artifacts = await get_artifact_store().get(document_id)
    if not artifacts:
        raise HTTPException(status_code=404, detail=_NOT_FOUND)

    history = [t.model_dump(mode="json") for t in req.history[-10:]]
    answer = await ChatAgent().run(
        artifacts=artifacts,
        history=history,
        question=req.question,
        language=req.language,
    )

    cited = sorted({m.group(0) for m in _CLAUSE_ID_RE.finditer(answer)})
    log.info(
        "followup_answered",
        extra={"document_id": document_id, "cited": cited, "answer_len": len(answer)},
    )
    return FollowupResponse(
        answer=answer.strip(),
        document_id=document_id,
        cited_clause_ids=cited,
    )
