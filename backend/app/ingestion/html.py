from __future__ import annotations

import logging
import re
from urllib.parse import parse_qs, urlparse

import httpx
from bs4 import BeautifulSoup

from app.core.errors import IngestionError
from app.ingestion.pdf import extract_text_from_pdf

log = logging.getLogger(__name__)

_ALLOWED_SCHEMES = {"http", "https"}
_STRIP_TAGS = ("script", "style", "nav", "footer", "aside", "noscript", "header", "form")
_USER_AGENT = "Mozilla/5.0 (compatible; LexGuard/0.1; +https://github.com/srujan0404/lexguard)"
_MIN_USABLE_CHARS = 200

_DRIVE_FILE_RE = re.compile(r"drive\.google\.com/file/d/([\w-]+)")
_DRIVE_OPEN_RE = re.compile(r"drive\.google\.com/open\?id=([\w-]+)")
_DOCS_DOC_RE = re.compile(r"docs\.google\.com/document/d/([\w-]+)")


def rewrite_share_url(url: str) -> str:
    """Normalise common share-URL patterns to a direct-fetchable form."""
    m = _DRIVE_FILE_RE.search(url) or _DRIVE_OPEN_RE.search(url)
    if m:
        return f"https://drive.google.com/uc?export=download&id={m.group(1)}"
    m = _DOCS_DOC_RE.search(url)
    if m:
        return f"https://docs.google.com/document/d/{m.group(1)}/export?format=txt"
    if "dropbox.com" in url:
        parsed = urlparse(url)
        qs = parse_qs(parsed.query)
        qs["dl"] = ["1"]
        from urllib.parse import urlencode

        return parsed._replace(query=urlencode({k: v[0] for k, v in qs.items()})).geturl()
    return url


async def fetch_and_clean(
    url: str, *, timeout: float = 15.0, max_bytes: int = 8 * 1024 * 1024
) -> str:
    parsed = urlparse(url)
    if parsed.scheme not in _ALLOWED_SCHEMES:
        raise IngestionError(f"Unsupported URL scheme: {parsed.scheme!r}.")
    if not parsed.netloc:
        raise IngestionError("URL is missing a host.")

    fetch_url = rewrite_share_url(url)
    if fetch_url != url:
        log.info("url_rewritten", extra={"from": url, "to": fetch_url})

    try:
        async with httpx.AsyncClient(
            timeout=timeout,
            follow_redirects=True,
            headers={
                "User-Agent": _USER_AGENT,
                "Accept": "text/html,application/xhtml+xml,application/pdf,text/plain,*/*",
            },
        ) as client:
            response = await client.get(fetch_url)
    except httpx.HTTPError as exc:
        raise IngestionError(f"Failed to fetch URL: {exc}") from exc

    if response.status_code >= 400:
        raise IngestionError(
            f"URL returned HTTP {response.status_code}. Make sure the link is public."
        )

    content_type = (response.headers.get("content-type") or "").lower()
    body = response.content[:max_bytes]

    if "application/pdf" in content_type or fetch_url.lower().endswith(".pdf"):
        try:
            text = extract_text_from_pdf(body)
        except IngestionError:
            raise
        if len(text) < _MIN_USABLE_CHARS:
            raise IngestionError(
                "PDF had less than 200 characters of extractable text. It may be a scan."
            )
        return text

    if "text/html" in content_type or "text/plain" in content_type or not content_type:
        text = _clean_html(body.decode(response.encoding or "utf-8", errors="replace"))
        if len(text) < _MIN_USABLE_CHARS:
            # Drive's interstitial / sign-in walls / paywalled pages land here.
            if "drive.google.com" in fetch_url or "docs.google.com" in fetch_url:
                raise IngestionError(
                    "Google Drive returned a sign-in page or virus-scan interstitial. "
                    "Make sure the file is shared as 'Anyone with the link' and try again."
                )
            raise IngestionError(
                "Page had less than 200 characters of readable text after stripping markup."
            )
        return text

    raise IngestionError(
        f"Unsupported content-type: {content_type or 'unknown'}. "
        "Send a public HTML page, plain text URL, or a PDF link."
    )


def _clean_html(html: str) -> str:
    soup = BeautifulSoup(html, "lxml")
    for tag in soup(list(_STRIP_TAGS)):
        tag.decompose()

    root = soup.find("main") or soup.find("article")
    if root is None:
        divs = soup.find_all("div")
        root = (
            max(divs, key=lambda d: len(d.get_text(strip=True))) if divs else (soup.body or soup)
        )
    return root.get_text(separator="\n", strip=True)
