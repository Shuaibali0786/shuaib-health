"""/openapi.json is hidden in production (FR-066) and still served in development."""

from fastapi.testclient import TestClient

from app.main import create_app
from tests.conftest import SettingsFactory


def test_openapi_is_404_in_production(settings_factory: SettingsFactory) -> None:
    client = TestClient(create_app(settings_factory(app_env="production")))
    assert client.get("/openapi.json").status_code == 404
    assert client.get("/docs").status_code == 404


def test_openapi_is_served_in_development(settings_factory: SettingsFactory) -> None:
    client = TestClient(create_app(settings_factory(app_env="development")))
    assert client.get("/openapi.json").status_code == 200
