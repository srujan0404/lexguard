from __future__ import annotations

from fastapi.testclient import TestClient


def test_list_statutes_returns_kb(client: TestClient) -> None:
    response = client.get("/api/v1/statutes")
    assert response.status_code == 200
    body = response.json()
    assert isinstance(body, list)
    assert len(body) >= 20
    sample = body[0]
    assert {"id", "act", "section", "title", "summary", "applies_to", "domains"} <= set(sample)
    assert "keywords" not in sample  # internal field stripped from public response


def test_get_statute_by_id(client: TestClient) -> None:
    response = client.get("/api/v1/statutes/ica_s27")
    assert response.status_code == 200
    body = response.json()
    assert body["id"] == "ica_s27"
    assert body["section"] == "27"
    assert "Indian Contract Act" in body["act"]


def test_get_statute_unknown_id_returns_404(client: TestClient) -> None:
    response = client.get("/api/v1/statutes/does_not_exist")
    assert response.status_code == 404
    body = response.json()
    assert body["error"]["code"] == "http_error"
