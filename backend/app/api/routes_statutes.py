from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.knowledge.retriever import all_statutes, statute_by_id
from app.schemas import StatuteResponse

router = APIRouter(prefix="/api/v1/statutes", tags=["statutes"])


def _to_public(entry: dict) -> StatuteResponse:
    return StatuteResponse(
        id=entry["id"],
        act=entry["act"],
        section=entry["section"],
        title=entry["title"],
        summary=entry["summary"],
        applies_to=list(entry.get("applies_to", [])),
        domains=list(entry.get("domains", [])),
    )


@router.get("", response_model=list[StatuteResponse], summary="List all indexed statutes")
async def list_statutes() -> list[StatuteResponse]:
    return [_to_public(e) for e in all_statutes()]


@router.get("/{statute_id}", response_model=StatuteResponse, summary="Get one statute by ID")
async def get_statute(statute_id: str) -> StatuteResponse:
    entry = statute_by_id(statute_id)
    if entry is None:
        raise HTTPException(status_code=404, detail=f"Unknown statute: {statute_id}")
    return _to_public(entry)
