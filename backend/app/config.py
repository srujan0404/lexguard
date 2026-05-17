from __future__ import annotations

from functools import lru_cache
from typing import Literal

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

LLMBackend = Literal["vertex", "aistudio"]
AppEnv = Literal["dev", "prod"]
LogLevel = Literal["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    LLM_BACKEND: LLMBackend = "aistudio"
    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-2.0-flash-001"
    GEMINI_MODEL_HEAVY: str = "gemini-2.0-pro-exp-02-05"

    GCP_PROJECT_ID: str = ""
    GCP_REGION: str = "asia-south1"

    MONGODB_URI: str = ""
    MONGODB_DB: str = "lexguard"

    APP_ENV: AppEnv = "dev"
    LOG_LEVEL: LogLevel = "INFO"
    APP_VERSION: str = "0.1.0"

    MAX_DOC_BYTES: int = Field(default=10 * 1024 * 1024, ge=1024)
    MAX_REQUEST_BYTES: int = Field(default=12 * 1024 * 1024, ge=1024)
    MAX_CLAUSES_PER_DOC: int = Field(default=200, ge=1, le=1000)
    RATE_LIMIT_PER_MINUTE: int = Field(default=30, ge=1)
    ALLOWED_ORIGINS: str = "*"

    @property
    def allowed_origins_list(self) -> list[str]:
        raw = self.ALLOWED_ORIGINS.strip()
        if raw == "*" or not raw:
            return ["*"]
        return [o.strip() for o in raw.split(",") if o.strip()]

    @property
    def is_prod(self) -> bool:
        return self.APP_ENV == "prod"

    @field_validator("GEMINI_API_KEY")
    @classmethod
    def _strip(cls, v: str) -> str:
        return v.strip()


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
