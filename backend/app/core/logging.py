from __future__ import annotations

import logging
import sys
import uuid
from contextvars import ContextVar
from datetime import UTC, datetime

from pythonjsonlogger import jsonlogger

_REQUEST_ID: ContextVar[str | None] = ContextVar("request_id", default=None)


def new_request_id() -> str:
    return uuid.uuid4().hex[:16]


def set_request_id(request_id: str) -> None:
    _REQUEST_ID.set(request_id)


def get_request_id() -> str | None:
    return _REQUEST_ID.get()


class _RequestIDFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        rid = _REQUEST_ID.get()
        if rid:
            record.request_id = rid
        return True


class _JsonFormatter(jsonlogger.JsonFormatter):
    def add_fields(self, log_record: dict, record: logging.LogRecord, message_dict: dict) -> None:
        super().add_fields(log_record, record, message_dict)
        log_record["timestamp"] = datetime.now(UTC).isoformat(timespec="milliseconds")
        log_record["level"] = record.levelname
        log_record["logger"] = record.name
        rid = getattr(record, "request_id", None) or _REQUEST_ID.get()
        if rid:
            log_record["request_id"] = rid


def setup_logging(level: str = "INFO") -> None:
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(_JsonFormatter("%(message)s"))
    handler.addFilter(_RequestIDFilter())

    root = logging.getLogger()
    root.handlers.clear()
    root.addHandler(handler)
    root.setLevel(level)

    for noisy in ("uvicorn.access", "uvicorn.error", "httpx"):
        logging.getLogger(noisy).setLevel(logging.WARNING)


def get_logger(name: str) -> logging.Logger:
    return logging.getLogger(name)
