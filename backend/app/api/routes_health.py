from __future__ import annotations

from fastapi import APIRouter

from app.api.deps import SettingsDep
from app.schemas import HealthResponse

router = APIRouter(tags=["meta"])


@router.get("/", summary="Service index")
async def root() -> dict[str, str]:
    return {"name": "LexGuard", "docs": "/docs"}


@router.get("/health", summary="Liveness probe", response_model=HealthResponse)
async def health(settings: SettingsDep) -> HealthResponse:
    return HealthResponse(
        status="ok",
        llm_backend=settings.LLM_BACKEND,
        version=settings.APP_VERSION,
        environment=settings.APP_ENV,
    )
