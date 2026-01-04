"""Application settings."""
from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    tracefoundry_env: str = Field("local", alias="TRACEFOUNDRY_ENV")
    db_url: str = Field("sqlite:///./tracefoundry.db", alias="DB_URL")
    payload_dir: Path = Field(Path("/data/payloads"), alias="PAYLOAD_DIR")
    payload_store: str = Field("filesystem", alias="PAYLOAD_STORE")
    basic_auth_users: str = Field(
        "viewer:viewer:viewer,engineer:engineer:engineer,admin:admin:admin",
        alias="BASIC_AUTH_USERS",
    )
    retention_traces_days: int = Field(7, alias="RETENTION_TRACES_DAYS")
    retention_payloads_days: int = Field(3, alias="RETENTION_PAYLOADS_DAYS")
    attribute_allowlist_path: Path = Field(
        Path("deploy/trace-allowlist.yaml"), alias="ATTRIBUTE_ALLOWLIST_PATH"
    )

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "allow"


@lru_cache
def get_settings() -> Settings:
    settings = Settings()
    settings.payload_dir.mkdir(parents=True, exist_ok=True)
    return settings
