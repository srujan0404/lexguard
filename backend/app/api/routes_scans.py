from __future__ import annotations

import logging
import re

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import Response

from app.agents.chat import ChatAgent
from app.persistence.artifacts import get_artifact_store
from app.persistence.audio import get_audio_store
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


@router.get(
    "/{document_id}/audio",
    response_class=Response,
    summary="Text-to-speech of the scorecard summary (MP3 from Cloud TTS, cached in GCS)",
)
async def get_audio(
    document_id: str,
    lang: str = Query("en", pattern="^(en|hi|hinglish)$"),
) -> Response:
    artifacts = await get_artifact_store().get(document_id)
    if not artifacts:
        raise HTTPException(status_code=404, detail=_NOT_FOUND)

    summary = (artifacts.get("summary") or "").strip()
    if not summary:
        raise HTTPException(status_code=404, detail="Scorecard has no summary to read.")

    # Prepend a short header so the listener has context.
    issuer = artifacts.get("issuer_name")
    risk = artifacts.get("risk_score")
    preface_en = f"LexGuard verdict on {issuer or 'this document'}. Risk score {risk} out of 100. "
    preface_hi = f"{issuer or 'is document'} ki LexGuard verdict. Risk score {risk} out of 100. "
    spoken = (preface_hi if lang in ("hi", "hinglish") else preface_en) + summary

    audio = await get_audio_store().get_or_synthesize(document_id, spoken, lang)
    if audio is None:
        raise HTTPException(
            status_code=503,
            detail="Text-to-speech is unavailable. Check the runtime SA has roles/cloudtts.user.",
        )
    return Response(
        content=audio,
        media_type="audio/mpeg",
        headers={
            "Cache-Control": "public, max-age=3600",
            "Content-Disposition": f'inline; filename="lexguard-{document_id}-{lang}.mp3"',
        },
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
