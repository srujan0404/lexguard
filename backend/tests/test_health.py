from __future__ import annotations

from fastapi.testclient import TestClient


def test_root_returns_service_index(client: TestClient) -> None:
    response = client.get("/")
    assert response.status_code == 200
    assert response.json() == {"name": "LexGuard", "docs": "/docs"}


def test_health_reports_runtime_metadata(client: TestClient) -> None:
    response = client.get("/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["llm_backend"] in {"vertex", "aistudio"}
    assert body["environment"] in {"dev", "prod"}
    assert body["version"]


def test_request_id_is_echoed(client: TestClient) -> None:
    response = client.get("/health")
    assert "x-request-id" in {k.lower() for k in response.headers}


def test_request_id_is_honored_when_supplied(client: TestClient) -> None:
    custom = "test-rid-1234567890"
    response = client.get("/health", headers={"X-Request-ID": custom})
    assert response.headers.get("X-Request-ID") == custom


def test_unknown_route_returns_structured_error(client: TestClient) -> None:
    response = client.get("/does-not-exist")
    assert response.status_code == 404
    body = response.json()
    assert "error" in body
    assert body["error"]["code"] == "http_error"
