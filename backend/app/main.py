from __future__ import annotations

import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes_analyze import router as analyze_router
from app.api.routes_health import router as health_router
from app.api.routes_reports import router as reports_router
from app.api.routes_scans import router as scans_router
from app.api.routes_statutes import router as statutes_router
from app.config import Settings, get_settings
from app.core.errors import register_exception_handlers
from app.core.logging import setup_logging
from app.core.middleware import (
    BodySizeLimitMiddleware,
    RateLimitMiddleware,
    RequestIDMiddleware,
)


def _build_lifespan(settings: Settings):
    @asynccontextmanager
    async def lifespan(_: FastAPI) -> AsyncIterator[None]:
        setup_logging(settings.LOG_LEVEL)
        log = logging.getLogger("lexguard.startup")
        log.info(
            "lexguard_boot",
            extra={
                "env": settings.APP_ENV,
                "llm_backend": settings.LLM_BACKEND,
                "version": settings.APP_VERSION,
            },
        )
        yield
        log.info("lexguard_shutdown")

    return lifespan


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or get_settings()

    app = FastAPI(
        title="LexGuard API",
        version=settings.APP_VERSION,
        description="Risk intelligence for contracts, policies, and quasi-legal documents.",
        openapi_tags=[
            {"name": "meta", "description": "Service health and metadata."},
            {"name": "analysis", "description": "Document risk analysis endpoints."},
            {"name": "statutes", "description": "Curated Indian civil-law knowledge base."},
            {"name": "reports", "description": "Shareable scorecard storage with 24h TTL."},
            {"name": "chat", "description": "Grounded follow-up chat scoped to a prior scan."},
        ],
        lifespan=_build_lifespan(settings),
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.allowed_origins_list,
        allow_origin_regex=r"^chrome-extension://[a-z]{32}$",
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=["*"],
        allow_credentials=False,
        expose_headers=["X-Request-ID"],
    )

    # Order matters: request_id first so all downstream logs are tagged.
    app.add_middleware(RequestIDMiddleware)
    app.add_middleware(BodySizeLimitMiddleware, max_bytes=settings.MAX_REQUEST_BYTES)
    app.add_middleware(
        RateLimitMiddleware,
        max_requests=settings.RATE_LIMIT_PER_MINUTE,
        window_seconds=60,
    )

    register_exception_handlers(app)
    app.include_router(health_router)
    app.include_router(analyze_router)
    app.include_router(statutes_router)
    app.include_router(reports_router)
    app.include_router(scans_router)

    return app


app = create_app()
