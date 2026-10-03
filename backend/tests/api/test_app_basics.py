import re

from fastapi.testclient import TestClient

from app.main import create_app
from app.middleware.security_headers import API_CSP, STATIC_HEADERS
from tests.conftest import SettingsFactory


def assert_security_headers(response_headers: dict[str, str] | object) -> None:
    headers = response_headers
    for name, value in STATIC_HEADERS.items():
        assert headers[name] == value  # type: ignore[index]
    assert "x-request-id" in headers  # type: ignore[operator]


def test_health_is_ok_and_not_cached(app_client: TestClient) -> None:
    response = app_client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
    assert response.headers["cache-control"] == "no-store"
    assert response.headers["content-security-policy"] == API_CSP
    assert_security_headers(response.headers)
    assert re.match(r"^[0-9a-f]{32}$", response.headers["x-request-id"])


def test_unknown_path_is_standard_404(app_client: TestClient) -> None:
    response = app_client.get("/nope")
    assert response.status_code == 404
    body = response.json()
    assert body["error"]["code"] == "not_found"
    assert body["error"]["requestId"] == response.headers["x-request-id"]
    assert_security_headers(response.headers)


def test_wrong_method_is_standard_405(app_client: TestClient) -> None:
    response = app_client.post("/health")
    assert response.status_code == 405
    assert response.json()["error"]["code"] == "method_not_allowed"
    assert_security_headers(response.headers)


def test_no_hsts_outside_production(app_client: TestClient) -> None:
    assert "strict-transport-security" not in app_client.get("/health").headers


def test_hsts_in_production(settings_factory: SettingsFactory) -> None:
    client = TestClient(create_app(settings_factory(app_env="production")))
    assert "strict-transport-security" in client.get("/health").headers


def test_docs_only_in_development(settings_factory: SettingsFactory) -> None:
    assert TestClient(create_app(settings_factory(app_env="test"))).get("/docs").status_code == 404
    dev = TestClient(create_app(settings_factory(app_env="development")))
    docs = dev.get("/docs")
    assert docs.status_code == 200
    assert "cdn.jsdelivr.net" in docs.headers["content-security-policy"]


def test_openapi_is_published(app_client: TestClient) -> None:
    response = app_client.get("/openapi.json")
    assert response.status_code == 200
    assert "/health" in response.json()["paths"]
