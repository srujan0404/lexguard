from __future__ import annotations

import os

import pytest
from fastapi.testclient import TestClient

os.environ.setdefault("LLM_BACKEND", "aistudio")
os.environ.setdefault("APP_ENV", "dev")
os.environ.setdefault("LOG_LEVEL", "WARNING")
os.environ.setdefault("ALLOWED_ORIGINS", "*")


@pytest.fixture(scope="session")
def client() -> TestClient:
    from app.main import create_app

    return TestClient(create_app())
