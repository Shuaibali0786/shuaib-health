from fastapi.testclient import TestClient

from app.main import create_app
from tests.api.test_app_basics import assert_security_headers
from tests.conftest import SettingsFactory

# These tests never reach the database: the paths below are 404s answered by the app itself.


def make(settings_factory: SettingsFactory, limit: int) -> TestClient:
    return TestClient(create_app(settings_factory(rate_limit_per_minute=limit)))


def test_excess_requests_get_429_with_retry_after(settings_factory: SettingsFactory) -> None:
    client = make(settings_factory, 3)
    assert [client.get("/api/v1/nope").status_code for _ in range(3)] == [404, 404, 404]
    for _ in range(3):
        response = client.get("/api/v1/nope")
        assert response.status_code == 429
        assert 1 <= int(response.headers["retry-after"]) <= 60
        error = response.json()["error"]
        assert error["code"] == "rate_limited"
        assert error["requestId"] == response.headers["x-request-id"]
        assert response.headers["cache-control"] == "no-store"
        assert_security_headers(response.headers)


def test_health_is_never_limited(settings_factory: SettingsFactory) -> None:
    client = make(settings_factory, 1)
    assert all(client.get("/health").status_code == 200 for _ in range(20))


def test_spoofed_forwarded_header_does_not_evade_the_limit(
    settings_factory: SettingsFactory,
) -> None:
    client = make(settings_factory, 2)
    codes = [
        client.get("/api/v1/nope", headers={"X-Forwarded-For": f"10.0.0.{i}"}).status_code
        for i in range(4)
    ]
    assert codes == [404, 404, 429, 429]


def test_trusted_proxy_hop_separates_clients(settings_factory: SettingsFactory) -> None:
    app = create_app(settings_factory(rate_limit_per_minute=1, trusted_proxy_hops=1))
    client = TestClient(app)
    first = client.get("/api/v1/nope", headers={"X-Forwarded-For": "1.1.1.1"})
    again = client.get("/api/v1/nope", headers={"X-Forwarded-For": "1.1.1.1"})
    other = client.get("/api/v1/nope", headers={"X-Forwarded-For": "2.2.2.2"})
    assert (first.status_code, again.status_code, other.status_code) == (404, 429, 404)
