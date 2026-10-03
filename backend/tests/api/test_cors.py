from fastapi.testclient import TestClient

from app.main import create_app
from tests.conftest import SettingsFactory

ALLOWED = "http://localhost:3000"


def make(settings_factory: SettingsFactory) -> TestClient:
    return TestClient(create_app(settings_factory(cors_origins=f"{ALLOWED},https://example.org")))


def test_allowed_origin_is_echoed_without_credentials(settings_factory: SettingsFactory) -> None:
    response = make(settings_factory).get("/health", headers={"Origin": ALLOWED})
    assert response.headers["access-control-allow-origin"] == ALLOWED
    assert "access-control-allow-credentials" not in response.headers
    exposed = response.headers["access-control-expose-headers"].lower()
    assert "etag" in exposed
    assert "x-request-id" in exposed
    assert "retry-after" in exposed


def test_disallowed_origin_gets_no_cors_headers(settings_factory: SettingsFactory) -> None:
    response = make(settings_factory).get("/health", headers={"Origin": "https://evil.example"})
    assert response.status_code == 200
    # Starlette still lists the exposed headers, but without Allow-Origin a browser grants
    # the page nothing, so no permission header may be present.
    assert not [h for h in response.headers if h.lower().startswith("access-control-allow-")]


def test_request_without_origin_has_no_cors_headers(settings_factory: SettingsFactory) -> None:
    response = make(settings_factory).get("/health")
    assert "access-control-allow-origin" not in response.headers


def test_preflight_only_grants_get(settings_factory: SettingsFactory) -> None:
    client = make(settings_factory)
    ok = client.options(
        "/api/v1/doctors",
        headers={"Origin": ALLOWED, "Access-Control-Request-Method": "GET"},
    )
    assert ok.status_code == 200
    assert ok.headers["access-control-allow-methods"] == "GET"

    denied = client.options(
        "/api/v1/doctors",
        headers={"Origin": ALLOWED, "Access-Control-Request-Method": "POST"},
    )
    assert denied.status_code == 400
    assert "POST" not in denied.headers.get("access-control-allow-methods", "")


def test_preflight_from_unknown_origin_is_denied(settings_factory: SettingsFactory) -> None:
    response = make(settings_factory).options(
        "/api/v1/doctors",
        headers={"Origin": "https://evil.example", "Access-Control-Request-Method": "GET"},
    )
    assert response.status_code == 400
    assert "access-control-allow-origin" not in response.headers


def test_rate_limited_response_still_carries_cors_headers(
    settings_factory: SettingsFactory,
) -> None:
    client = TestClient(create_app(settings_factory(rate_limit_per_minute=1)))
    client.get("/api/v1/nope", headers={"Origin": ALLOWED})
    limited = client.get("/api/v1/nope", headers={"Origin": ALLOWED})
    assert limited.status_code == 429
    assert limited.headers["access-control-allow-origin"] == ALLOWED
