from __future__ import annotations

import time
from collections import defaultdict, deque
from collections.abc import Awaitable, Callable

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, Response
from starlette.types import ASGIApp

from app.core.errors import _error_body
from app.core.logging import new_request_id, set_request_id

Handler = Callable[[Request], Awaitable[Response]]


class RequestIDMiddleware(BaseHTTPMiddleware):
    header_name = "X-Request-ID"

    async def dispatch(self, request: Request, call_next: Handler) -> Response:
        incoming = request.headers.get(self.header_name)
        rid = (
            incoming.strip() if incoming and 8 <= len(incoming.strip()) <= 64 else new_request_id()
        )
        set_request_id(rid)
        response = await call_next(request)
        response.headers[self.header_name] = rid
        return response


class BodySizeLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app: ASGIApp, *, max_bytes: int) -> None:
        super().__init__(app)
        self.max_bytes = max_bytes

    async def dispatch(self, request: Request, call_next: Handler) -> Response:
        content_length = request.headers.get("content-length")
        if content_length and content_length.isdigit() and int(content_length) > self.max_bytes:
            # Outer CORSMiddleware does not always wrap early returns from BaseHTTPMiddleware,
            # so emit the allow-origin header here to keep browser errors readable.
            headers: dict[str, str] = {}
            if request.headers.get("origin"):
                headers["Access-Control-Allow-Origin"] = "*"
                headers["Vary"] = "Origin"
            return JSONResponse(
                status_code=413,
                headers=headers,
                content=_error_body(
                    "payload_too_large",
                    f"Request body exceeds {self.max_bytes} bytes.",
                ),
            )
        return await call_next(request)


# In-memory only - not safe across replicas. Swap for Redis before scaling out.
class RateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(
        self,
        app: ASGIApp,
        *,
        max_requests: int,
        window_seconds: int = 60,
        exempt_paths: tuple[str, ...] = ("/", "/health", "/docs", "/openapi.json", "/redoc"),
    ) -> None:
        super().__init__(app)
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self.exempt_paths = exempt_paths
        self._hits: dict[str, deque[float]] = defaultdict(deque)

    async def dispatch(self, request: Request, call_next: Handler) -> Response:
        if request.url.path in self.exempt_paths:
            return await call_next(request)

        client = request.client.host if request.client else "unknown"
        now = time.monotonic()
        window_start = now - self.window_seconds
        hits = self._hits[client]
        while hits and hits[0] < window_start:
            hits.popleft()

        if len(hits) >= self.max_requests:
            retry_after = max(1, int(self.window_seconds - (now - hits[0])))
            headers = {"Retry-After": str(retry_after)}
            if request.headers.get("origin"):
                headers["Access-Control-Allow-Origin"] = "*"
                headers["Vary"] = "Origin"
            return JSONResponse(
                status_code=429,
                headers=headers,
                content=_error_body(
                    "rate_limited",
                    f"Too many requests. Try again in {retry_after}s.",
                ),
            )

        hits.append(now)
        return await call_next(request)
