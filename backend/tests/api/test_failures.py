from collections.abc import Callable

import pytest
from fastapi.testclient import TestClient
from pydantic import SecretStr
from sqlalchemy import Engine

from app.db import get_engine, get_session, make_engine
from app.main import create_app
from app.repositories import departments as departments_repo
from app.routers import health as health_router
from tests.conftest import SettingsFactory

UNREACHABLE = SecretStr("postgresql+psycopg://leakuser:leakpw@127.0.0.1:1/leakdb?sslmode=require")


def test_ready_is_503_without_details_when_the_database_is_down(
    settings_factory: SettingsFactory,
) -> None:
    app = create_app(settings_factory())
    app.dependency_overrides[get_engine] = lambda: make_engine(UNREACHABLE, connect_timeout=1)
    response = TestClient(app).get("/ready")
    assert response.status_code == 503
    assert response.json()["error"]["code"] == "service_unavailable"
    assert response.headers["cache-control"] == "no-store"
    for leaked in ("127.0.0.1", "leakuser", "leakpw", "leakdb", "psycopg", "postgresql"):
        assert leaked not in response.text


def test_catalog_route_with_database_down_is_503(settings_factory: SettingsFactory) -> None:
    app = create_app(settings_factory())
    engine: Engine = make_engine(UNREACHABLE, connect_timeout=1)

    from sqlmodel import Session

    def session_on_dead_database() -> Session:
        return Session(engine)

    app.dependency_overrides[get_session] = session_on_dead_database
    response = TestClient(app).get("/api/v1/departments")
    assert response.status_code == 503
    assert response.json()["error"]["code"] == "service_unavailable"
    assert "leakpw" not in response.text
    assert "SELECT" not in response.text


def test_unexpected_error_is_a_generic_500(
    settings_factory: SettingsFactory, monkeypatch: pytest.MonkeyPatch
) -> None:
    def boom(*_: object, **__: object) -> None:
        raise RuntimeError("secret detail")

    monkeypatch.setattr(departments_repo, "list_departments", boom)
    app = create_app(settings_factory())
    app.dependency_overrides[get_session] = lambda: object()
    response = TestClient(app, raise_server_exceptions=False).get("/api/v1/departments")
    assert response.status_code == 500
    assert response.json()["error"]["code"] == "internal_error"
    assert "secret detail" not in response.text
    assert "Traceback" not in response.text
    assert response.headers["x-request-id"] == response.json()["error"]["requestId"]
    assert response.headers["x-content-type-options"] == "nosniff"


@pytest.mark.db
def test_ready_is_ok_when_database_is_migrated(client: TestClient) -> None:
    response = client.get("/ready")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


@pytest.mark.db
def test_ready_is_503_when_schema_is_not_at_head(
    make_client: Callable[..., TestClient], monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(health_router, "head_revision", lambda: "9999_not_applied")
    response = make_client().get("/ready")
    assert response.status_code == 503
    assert response.json()["error"]["code"] == "service_unavailable"
    assert "9999" not in response.text
