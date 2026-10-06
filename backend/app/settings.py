"""Application settings, read from environment variables and backend/.env.

Validation errors name the offending setting but never echo its value, and every database
URL is a ``SecretStr`` so it is masked in ``repr``, logs and tracebacks.
"""

import re
from functools import lru_cache
from pathlib import Path
from typing import Annotated, Literal, Self
from urllib.parse import parse_qs, urlsplit

from pydantic import Field, SecretStr, ValidationInfo, field_validator, model_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict

ENV_FILE = Path(__file__).resolve().parent.parent / ".env"

_SSL_MODES = {"require", "verify-ca", "verify-full"}
_SCHEME = "postgresql+psycopg"
_ORIGIN_RE = re.compile(r"^https?://[A-Za-z0-9.-]+(:\d{1,5})?$")
_DB_URL_FIELDS = ("database_url", "direct_database_url", "test_database_url")
_MIN_SECRET_LENGTH = 32


def _host(url: str) -> str:
    return (urlsplit(url).hostname or "").lower()


def normalise_db_url(url: str) -> tuple[str, int | None, str]:
    """Identity of a database for comparisons: host, port and database name (no credentials)."""
    parts = urlsplit(url)
    return ((parts.hostname or "").lower(), parts.port, parts.path.strip("/"))


def check_db_url(name: str, url: str) -> None:
    """Raise ``ValueError`` naming ``name`` if ``url`` is not an SSL psycopg Postgres URL."""
    parts = urlsplit(url)
    if parts.scheme != _SCHEME or not parts.hostname or not parts.path.strip("/"):
        raise ValueError(f"{name} must be a {_SCHEME}://user:password@host/database URL")
    sslmode = parse_qs(parts.query).get("sslmode", [""])[0]
    if sslmode not in _SSL_MODES:
        raise ValueError(f"{name} must set sslmode=require (or verify-ca / verify-full)")


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=ENV_FILE, env_file_encoding="utf-8", extra="ignore", hide_input_in_errors=True
    )

    app_env: Literal["development", "test", "production"]
    database_url: SecretStr
    direct_database_url: SecretStr
    test_database_url: SecretStr | None = None
    cors_origins: Annotated[list[str], NoDecode] = Field(default_factory=list)
    rate_limit_per_minute: int = Field(60, ge=1, le=10000)
    trusted_proxy_hops: int = Field(0, ge=0, le=5)
    cache_max_age_seconds: int = Field(300, ge=0, le=86400)
    image_base_path: str = "/images/"
    log_level: Literal["DEBUG", "INFO", "WARNING", "ERROR"] = "INFO"
    booking_proxy_secret: SecretStr
    privacy_hash_key: SecretStr
    session_secret: SecretStr
    demo_mode: bool = True
    booking_purge_after_days: int = Field(7, ge=1, le=90)
    booking_limit_per_ip_per_hour: int = Field(10, ge=1, le=1000)
    booking_limit_per_phone_per_day: int = Field(5, ge=1, le=100)
    lookup_limit_per_ip_per_minute: int = Field(20, ge=1, le=1000)
    audit_purge_after_days: int = Field(90, ge=7, le=365)
    staff_idle_minutes: int = Field(30, ge=1, le=240)
    staff_absolute_hours: int = Field(12, ge=1, le=72)
    staff_max_sessions: int = Field(3, ge=1, le=20)
    login_lock_failures: int = Field(5, ge=1, le=50)
    login_lock_minutes: int = Field(15, ge=1, le=1440)
    login_limit_per_ip_per_15min: int = Field(20, ge=1, le=1000)
    demo_limit_per_ip_per_hour: int = Field(10, ge=1, le=1000)
    demo_session_hours: int = Field(2, ge=1, le=24)
    status_undo_seconds: int = Field(10, ge=1, le=120)

    @field_validator("booking_proxy_secret", "privacy_hash_key", "session_secret", mode="before")
    @classmethod
    def _secret_is_long_enough(cls, value: object, info: ValidationInfo) -> object:
        raw = value.get_secret_value() if isinstance(value, SecretStr) else value
        if not isinstance(raw, str) or len(raw) < _MIN_SECRET_LENGTH:
            name = str(info.field_name).upper()
            raise ValueError(f"{name} is required (at least {_MIN_SECRET_LENGTH} characters)")
        return value

    @field_validator("test_database_url", mode="before")
    @classmethod
    def _empty_test_url_is_none(cls, value: object) -> object:
        return None if value == "" else value

    @field_validator("cors_origins", mode="before")
    @classmethod
    def _split_origins(cls, value: object) -> object:
        if isinstance(value, str):
            return [item.strip() for item in value.split(",") if item.strip()]
        return value

    @field_validator("cors_origins")
    @classmethod
    def _check_origins(cls, value: list[str]) -> list[str]:
        for origin in value:
            if origin == "*" or not _ORIGIN_RE.match(origin):
                raise ValueError("cors_origins must list explicit http(s)://host[:port] origins")
        return value

    @model_validator(mode="after")
    def _check_database_urls(self) -> Self:
        for name in _DB_URL_FIELDS:
            secret: SecretStr | None = getattr(self, name)
            if secret is not None:
                check_db_url(name, secret.get_secret_value())

        app_url = self.database_url.get_secret_value()
        direct_url = self.direct_database_url.get_secret_value()
        if _host(app_url).endswith(".neon.tech") and "-pooler" not in _host(app_url):
            raise ValueError("database_url must be the pooled Neon URL (host contains -pooler)")
        if _host(direct_url).endswith(".neon.tech") and "-pooler" in _host(direct_url):
            raise ValueError("direct_database_url must be the direct Neon URL (no -pooler)")

        if self.test_database_url is not None:
            test_id = normalise_db_url(self.test_database_url.get_secret_value())
            dev_ids = {normalise_db_url(app_url), normalise_db_url(direct_url)}
            pooled_host, port, db = normalise_db_url(app_url)
            dev_ids.add((pooled_host.replace("-pooler", ""), port, db))
            if test_id in dev_ids:
                raise ValueError("test_database_url must point at a different database than dev")
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
