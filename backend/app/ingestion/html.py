from __future__ import annotations

import logging
from urllib.parse import urlparse

import httpx
from bs4 import BeautifulSoup

from app.core.errors import IngestionError

log = logging.getLogger(__name__)

_ALLOWED_SCHEMES = {"http", "https"}
_STRIP_TAGS = ("script", "style", "nav", "footer", "aside", "noscript", "header", "form")
_USER_AGENT = "LexGuard/0.1 (+https://github.com/lexguard)"


async def fetch_and_clean(url: str, *, timeout: float = 10.0, max_bytes: int = 4 * 1024 * 1024) -> str:
    parsed = urlparse(url)
    if parsed.scheme not in _ALLOWED_SCHEMES:
        raise IngestionError(f"Unsupported URL scheme: {parsed.scheme!r}.")
    if not parsed.netloc:
        raise IngestionError("URL is missing a host.")

    try:
        async with httpx.AsyncClient(
            timeout=timeout,
            follow_redirects=True,
            headers={"User-Agent": _USER_AGENT, "Accept": "text/html,*/*"},
        ) as client:
            response = await client.get(url)
    except httpx.HTTPError as exc:
        raise IngestionError(f"Failed to fetch URL: {exc}") from exc

    if response.status_code >= 400:
        raise IngestionError(f"URL returned HTTP {response.status_code}.")

    content_type = response.headers.get("content-type", "").lower()
    if "text/html" not in content_type and "text/plain" not in content_type:
        raise IngestionError(f"URL returned non-text content-type: {content_type or 'unknown'}.")

    body = response.content[:max_bytes]
    text = _clean_html(body.decode(response.encoding or "utf-8", errors="replace"))
    if not text.strip():
        raise IngestionError("Page contained no readable text after stripping markup.")
    return text


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
