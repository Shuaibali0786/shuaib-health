"""The premium voice provider's token endpoint (Feature 013): off by default, needs the proxy
secret, rate-limited per visitor, never returns or logs the key, and fails safe. A fake fetcher
stands in for the speech service: no test makes a network call."""

import logging
from collections.abc import Callable
from typing import Any

import pytest
from fastapi.testclient import TestClient
from httpx2 import Response

from app.routers.speech import get_fetcher
from tests.api.admin_support import SECRET

pytestmark = pytest.mark.db

KEY = "fake-speech-key-not-real-0000000000000000"
ON = {"azure_speech_key": KEY, "azure_speech_region": "southeastasia"}
HEADERS = {"X-Proxy-Secret": SECRET, "X-Client-IP": "203.0.113.21"}
TOKEN = "eyJ-fake-token-not-real-0123456789"


class FakeFetcher:
    def __init__(self, token: str = TOKEN, error: Exception | None = None) -> None:
        self.calls: list[tuple[str, str]] = []
        self.token = token
        self.error = error

    def __call__(self, url: str, key: str) -> str:
        self.calls.append((url, key))
        if self.error:
            raise self.error
        return self.token


@pytest.fixture
def speech(make_client: Callable[..., TestClient]) -> Callable[..., tuple[TestClient, FakeFetcher]]:
    def build(
        fetcher: FakeFetcher | None = None, **overrides: Any
    ) -> tuple[TestClient, FakeFetcher]:
        fake = fetcher or FakeFetcher()
        client = make_client(**{**ON, **overrides})
        client.app.dependency_overrides[get_fetcher] = lambda: fake  # type: ignore[attr-defined]
        return client, fake

    return build


def ask(client: TestClient, headers: dict[str, str] | None = None) -> Response:
    return client.post("/api/v1/speech/token", headers=headers or HEADERS)


def test_off_by_default_answers_404(make_client: Callable[..., TestClient]) -> None:
    response = ask(make_client())
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "not_found"


def test_a_key_without_a_region_stays_off(
    speech: Callable[..., tuple[TestClient, FakeFetcher]],
) -> None:
    client, fake = speech(azure_speech_region=None)
    assert ask(client).status_code == 404
    assert fake.calls == []


def test_needs_the_proxy_secret(speech: Callable[..., tuple[TestClient, FakeFetcher]]) -> None:
    client, fake = speech()
    assert ask(client, headers={"X-Client-IP": "203.0.113.21"}).status_code == 403
    assert fake.calls == []


def test_issues_a_short_lived_token_from_the_region_and_never_the_key(
    speech: Callable[..., tuple[TestClient, FakeFetcher]],
) -> None:
    client, fake = speech()
    response = ask(client)
    assert response.status_code == 200, response.text
    assert response.json() == {"token": TOKEN, "region": "southeastasia", "expiresInSeconds": 600}
    assert response.headers["cache-control"] == "no-store"
    assert KEY not in response.text
    [(url, key)] = fake.calls
    assert url == "https://southeastasia.api.cognitive.microsoft.com/sts/v1.0/issueToken"
    assert key == KEY


def test_rate_limited_per_visitor(speech: Callable[..., tuple[TestClient, FakeFetcher]]) -> None:
    client, fake = speech(speech_token_per_ip_per_hour=2)
    assert ask(client).status_code == 200
    assert ask(client).status_code == 200
    third = ask(client)
    assert third.status_code == 429
    assert int(third.headers["retry-after"]) > 0
    assert len(fake.calls) == 2
    other = {**HEADERS, "X-Client-IP": "203.0.113.99"}
    assert ask(client, headers=other).status_code == 200


def test_a_service_failure_is_503_so_the_website_falls_back(
    speech: Callable[..., tuple[TestClient, FakeFetcher]],
) -> None:
    client, _ = speech(FakeFetcher(error=TimeoutError()))
    response = ask(client)
    assert response.status_code == 503
    assert response.json()["error"]["code"] == "service_unavailable"
    client, _ = speech(FakeFetcher(token=""))
    assert ask(client).status_code == 503


def test_neither_the_key_nor_the_token_is_logged(
    speech: Callable[..., tuple[TestClient, FakeFetcher]], caplog: pytest.LogCaptureFixture
) -> None:
    client, _ = speech()
    with caplog.at_level(logging.DEBUG):
        assert ask(client).status_code == 200
    text = "\n".join(f"{r.getMessage()} {r.__dict__}" for r in caplog.records)
    assert KEY not in text
    assert TOKEN not in text
