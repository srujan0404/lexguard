from __future__ import annotations

import io
from typing import Any

import httpx
import pytest
import respx
from fastapi.testclient import TestClient

from app.schemas import (
    ClauseVerdict,
    DocumentScorecard,
    Domain,
    Severity,
    SeverityCounts,
)


def _canned_scorecard() -> DocumentScorecard:
    return DocumentScorecard(
        document_id="abc123def456",
        domain=Domain.EMPLOYMENT,
        overall_severity=Severity.HIGH,
        risk_score=72,
        counts=SeverityCounts(low=0, medium=0, high=1, critical=0),
        top_concerns=["Probation can be extended indefinitely"],
        pre_sign_checklist=["Ask HR for a written probation cap."],
        clauses=[
            ClauseVerdict(
                clause_id="c1",
                title="Probation",
                severity=Severity.HIGH,
                plain_language="Probation can be extended at will.",
                why_it_matters="You may stay on probation indefinitely.",
                what_to_do="Ask for a written cap.",
                safer_version="Probation capped at 6 months.",
                risk_categories=[],
                statutes_cited=[],
                confidence=0.9,
            )
        ],
        summary="One high-severity finding.",
        processing_ms=42,
        model_versions={"extractor": "gemini-flash-latest"},
    )


@pytest.fixture
def stub_analyze(monkeypatch: pytest.MonkeyPatch) -> dict[str, Any]:
    captured: dict[str, Any] = {}

    async def fake(*, text: str, domain, language, source_url=None, llm=None) -> DocumentScorecard:
        captured.update(text=text, domain=domain, language=language, source_url=source_url)
        return _canned_scorecard()

    monkeypatch.setattr("app.api.routes_analyze.analyze_document", fake)
    return captured


def test_analyze_text_happy_path(client: TestClient, stub_analyze: dict[str, Any]) -> None:
    payload = {
        "text": "This is a sufficiently long sample of contract text for analysis.",
        "domain_hint": "employment",
        "language": "en",
    }
    response = client.post("/api/v1/analyze/text", json=payload)
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["overall_severity"] == "high"
    assert body["counts"]["high"] == 1
    assert stub_analyze["domain"] == Domain.EMPLOYMENT
    assert stub_analyze["language"] == "en"


def test_analyze_text_rejects_short_input(client: TestClient) -> None:
    response = client.post("/api/v1/analyze/text", json={"text": "short"})
    assert response.status_code == 422
    body = response.json()
    assert body["error"]["code"] == "validation_failed"


def test_analyze_text_rejects_unknown_fields(client: TestClient) -> None:
    response = client.post(
        "/api/v1/analyze/text",
        json={"text": "x" * 50, "secret_flag": True},
    )
    assert response.status_code == 422


def test_analyze_pdf_rejects_wrong_mime(client: TestClient, stub_analyze: dict[str, Any]) -> None:
    response = client.post(
        "/api/v1/analyze/pdf",
        files={"file": ("not.pdf", io.BytesIO(b"plain text"), "text/plain")},
        data={"domain_hint": "consumer"},
    )
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "ingestion_failed"


def test_analyze_pdf_happy_path(
    client: TestClient, stub_analyze: dict[str, Any], monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(
        "app.api.routes_analyze.extract_text_from_pdf",
        lambda data: "Extracted contract text from the PDF, suitably long for analysis.",
    )
    response = client.post(
        "/api/v1/analyze/pdf",
        files={"file": ("offer.pdf", io.BytesIO(b"%PDF-1.4 fake bytes"), "application/pdf")},
        data={"domain_hint": "employment", "language": "en"},
    )
    assert response.status_code == 200, response.text
    assert response.json()["risk_score"] == 72
    assert stub_analyze["text"].startswith("Extracted contract text")


def _settings_with(**overrides):
    from app.config import Settings

    base = {
        "LLM_BACKEND": "aistudio",
        "GEMINI_API_KEY": "test-key",
        "APP_ENV": "dev",
        "LOG_LEVEL": "WARNING",
    }
    base.update(overrides)
    return Settings(**base)


def test_analyze_pdf_rejects_oversized(
    client: TestClient, stub_analyze: dict[str, Any], monkeypatch: pytest.MonkeyPatch
) -> None:
    from app.api import routes_analyze
    from app.config import get_settings

    monkeypatch.setattr(routes_analyze, "extract_text_from_pdf", lambda b: "ok")
    client.app.dependency_overrides[get_settings] = lambda: _settings_with(MAX_DOC_BYTES=1024)
    try:
        big = b"%PDF-1.4" + b"x" * 2048
        response = client.post(
            "/api/v1/analyze/pdf",
            files={"file": ("big.pdf", io.BytesIO(big), "application/pdf")},
        )
    finally:
        client.app.dependency_overrides.pop(get_settings, None)

    assert response.status_code == 413
    assert response.json()["error"]["code"] == "payload_too_large"


def test_body_size_limit_returns_cors_headers(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("MAX_REQUEST_BYTES", "1024")
    from app.config import get_settings
    from app.main import create_app

    get_settings.cache_clear()
    try:
        with TestClient(create_app()) as small_client:
            response = small_client.post(
                "/api/v1/analyze/pdf",
                files={"file": ("x.pdf", io.BytesIO(b"x" * 2048), "application/pdf")},
                headers={"Origin": "http://localhost:3000"},
            )
    finally:
        get_settings.cache_clear()

    assert response.status_code == 413
    assert response.json()["error"]["code"] == "payload_too_large"
    assert response.headers.get("access-control-allow-origin") == "*"


def test_analyze_url_rejects_bad_scheme(client: TestClient) -> None:
    response = client.post(
        "/api/v1/analyze/url",
        json={"url": "ftp://example.com/terms"},
    )
    assert response.status_code == 422


@respx.mock
def test_analyze_url_happy_path(client: TestClient, stub_analyze: dict[str, Any]) -> None:
    html = """
        <html><head><title>Terms</title><script>evil()</script></head>
        <body>
          <header>Site header</header>
          <main>
            <h1>Terms of Service</h1>
            <p>By using our Services, you consent to the collection, storage, processing, and sharing of your personal data with our affiliates and third-party advertising partners for any business purpose we deem appropriate.</p>
            <p>We may modify these Terms at any time without prior notice. Continued use constitutes acceptance. We retain your data indefinitely and reserve the right to share with any third party for legitimate business interests.</p>
            <p>All disputes shall be resolved exclusively in courts of Singapore under foreign jurisdiction.</p>
          </main>
          <footer>Site footer</footer>
        </body></html>
    """
    respx.get("https://example.com/terms").mock(
        return_value=httpx.Response(200, html=html, headers={"content-type": "text/html"})
    )
    response = client.post(
        "/api/v1/analyze/url",
        json={"url": "https://example.com/terms", "domain_hint": "privacy"},
    )
    assert response.status_code == 200, response.text
    assert stub_analyze["source_url"] == "https://example.com/terms"
    assert "consent" in stub_analyze["text"].lower()
    assert "site header" not in stub_analyze["text"].lower()
    assert "evil" not in stub_analyze["text"].lower()


@respx.mock
def test_analyze_url_rejects_non_html(client: TestClient) -> None:
    respx.get("https://example.com/data.json").mock(
        return_value=httpx.Response(
            200, content=b'{"x":1}', headers={"content-type": "application/json"}
        )
    )
    response = client.post(
        "/api/v1/analyze/url",
        json={"url": "https://example.com/data.json"},
    )
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "ingestion_failed"


@respx.mock
def test_analyze_url_propagates_http_error(client: TestClient) -> None:
    respx.get("https://example.com/missing").mock(return_value=httpx.Response(404))
    response = client.post(
        "/api/v1/analyze/url",
        json={"url": "https://example.com/missing"},
    )
    assert response.status_code == 422
