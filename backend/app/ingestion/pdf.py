from __future__ import annotations

import io
import logging

import pdfplumber

from app.core.errors import IngestionError

log = logging.getLogger(__name__)


def extract_text_from_pdf(file_bytes: bytes) -> str:
    try:
        with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
            pages = [page.extract_text() or "" for page in pdf.pages]
    except Exception as exc:
        raise IngestionError(f"Failed to parse PDF: {exc}") from exc

    text = "\n\n".join(p.strip() for p in pages if p.strip()).strip()
    if not text:
        raise IngestionError(
            "PDF has no extractable text. It is likely scanned; Document AI is required."
        )
    if len(text) < 200:
        log.warning("pdf_text_short", extra={"length": len(text), "pages": len(pages)})
    return text


def extract_with_documentai(file_bytes: bytes) -> str:
    raise NotImplementedError("Document AI ingestion is disabled in v1 to preserve GCP credits.")
