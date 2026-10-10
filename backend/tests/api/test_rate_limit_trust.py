"""Fair rate limiting behind the proxies (007, US4): our website server is not one shared bucket.

These tests never reach the database: ``/api/v1/nope`` is a 404 answered by the app itself.
"""

from fastapi.testclient import TestClient

from app.main import create_app
from tests.conftest import SettingsFactory

PATH = "/api/v1/nope"
SECRET = "test-proxy-secret-0123456789abcdef"
SERVER = {"X-Proxy-Secret": SECRET}


def make(settings_factory: SettingsFactory, limit: int, exempt: bool = True) -> TestClient:
    return TestClient(
        create_app(settings_factory(rate_limit_per_minute=limit, trusted_server_exempt=exempt))
    )


def test_trusted_catalog_requests_are_not_limited_past_the_default(
    settings_factory: SettingsFactory,
) -> None:
    client = make(settings_factory, 60)
    codes = [client.get(PATH, headers=SERVER).status_code for _ in range(61)]
    assert 429 not in codes  # the 61st trusted request still passes


def test_a_hundred_trusted_requests_in_a_minute_get_no_429(
    settings_factory: SettingsFactory,
) -> None:
    client = make(settings_factory, 60)
    codes = [client.get(PATH, headers=SERVER).status_code for _ in range(100)]
    assert codes.count(429) == 0


def test_without_the_flag_the_website_server_counts_like_any_client(
    settings_factory: SettingsFactory,
) -> None:
    client = make(settings_factory, 3, exempt=False)
    codes = [client.get(PATH, headers=SERVER).status_code for _ in range(4)]
    assert codes == [404, 404, 404, 429]


def test_forged_forwarded_header_without_the_secret_is_not_trusted(
    settings_factory: SettingsFactory,
) -> None:
    client = make(settings_factory, 2)
    forged = {"X-Forwarded-For": "198.51.100.7", "X-Client-IP": "198.51.100.8"}
    codes = [client.get(PATH, headers=forged).status_code for _ in range(3)]
    assert codes == [404, 404, 429]  # one socket address, so one bucket


def test_a_wrong_secret_is_not_exempt(settings_factory: SettingsFactory) -> None:
    client = make(settings_factory, 2)
    wrong = {"X-Proxy-Secret": "x" * 32}
    codes = [client.get(PATH, headers=wrong).status_code for _ in range(3)]
    assert codes == [404, 404, 429]


def test_two_visitors_through_the_server_are_independent(
    settings_factory: SettingsFactory,
) -> None:
    client = make(settings_factory, 2)

    def call(ip: str) -> int:
        return client.get(PATH, headers={**SERVER, "X-Client-IP": ip}).status_code

    assert [call("203.0.113.1"), call("203.0.113.1")] == [404, 404]
    assert call("203.0.113.1") == 429  # a named visitor is limited, not exempt
    assert call("203.0.113.2") == 404  # another visitor behind the same server
