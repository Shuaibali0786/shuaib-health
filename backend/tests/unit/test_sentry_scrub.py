"""Sentry events leave the process with no personal data (007, US3)."""

import asyncio
import json
from collections.abc import Iterator
from typing import Any, ClassVar

import pytest
import sentry_sdk
from pydantic import SecretStr
from sentry_sdk.envelope import Envelope
from sentry_sdk.transport import Transport

from app import observability
from app.errors import UnhandledErrorMiddleware
from tests.conftest import SettingsFactory

PHONE = "0300 1234567"
EMAIL = "fake.patient@example.org"
REFERENCE = "ABCDE-FGHJK"


def dirty_event() -> dict[str, Any]:
    return {
        "message": f"{EMAIL} rang {PHONE} about {REFERENCE}",
        "user": {"email": EMAIL, "ip_address": "203.0.113.9"},
        "server_name": "laptop-of-someone",
        "request": {
            "url": f"https://api.example.org/api/v1/appointments/{REFERENCE}?phone={PHONE}",
            "query_string": f"phone={PHONE}&email={EMAIL}",
            "cookies": {"session": "secret-cookie"},
            "data": {"name": "Ali Khan", "mobile": PHONE},
            "headers": {
                "User-Agent": "curl/8",
                "Cookie": "session=secret-cookie",
                "Authorization": "Bearer abc",
                "X-Proxy-Secret": "proxy-secret-value",
                "X-Session-Token": "tok",
                "X-CSRF-Token": "csrf",
                "X-Client-IP": "203.0.113.9",
                "X-Forwarded-For": "203.0.113.9",
                "X-Vercel-Protection-Bypass": "bypass",
                "X-Test-Phone": PHONE,
            },
        },
        "exception": {"values": [{"type": "RuntimeError", "value": f"failed for {EMAIL}"}]},
        "breadcrumbs": {"values": [{"message": f"GET /lookup?ref={REFERENCE}"}]},
    }


def test_scrub_drops_identity_credentials_queries_and_bodies() -> None:
    clean = observability.scrub_event(dirty_event())
    assert "user" not in clean and "server_name" not in clean
    request = clean["request"]
    for dropped in ("cookies", "data", "query_string"):
        assert dropped not in request
    assert request["url"] == "https://api.example.org/api/v1/appointments/[reference]"
    assert set(request["headers"]) == {"User-Agent", "X-Test-Phone"}


def test_scrub_masks_phone_email_and_reference_everywhere() -> None:
    text = json.dumps(observability.scrub_event(dirty_event()))
    for leaked in (PHONE, "1234567", EMAIL, REFERENCE, "FGHJK", "secret-cookie", "Ali Khan"):
        assert leaked not in text
    for marker in ("[email]", "[phone]", "[reference]"):
        assert marker in text


@pytest.mark.parametrize(
    ("raw", "masked"),
    [
        ("call +92 300 1234567 now", "call [phone] now"),
        ("03001234567", "[phone]"),
        ("a.b+c@mail.example.com", "[email]"),
        ("ref abcde-fghjk and ABCDEFGHJK", "ref [reference] and [reference]"),
        ("status 503 after 12 retries", "status 503 after 12 retries"),
    ],
)
def test_mask_text(raw: str, masked: str) -> None:
    assert observability.mask_text(raw) == masked


def test_reporting_is_off_without_a_dsn(settings_factory: SettingsFactory) -> None:
    assert observability.init_observability(settings_factory()) is False


class Capture(Transport):
    sent: ClassVar[list[dict[str, Any]]] = []

    def capture_envelope(self, envelope: Envelope) -> None:
        for item in envelope.items:
            if item.headers.get("type") == "event" and item.payload.json is not None:
                self.sent.append(item.payload.json)


@pytest.fixture
def captured(settings_factory: SettingsFactory) -> Iterator[list[dict[str, Any]]]:
    Capture.sent = []
    settings = settings_factory(sentry_dsn=SecretStr("https://public@o0.ingest.sentry.io/1"))
    assert observability.init_observability(settings) is True
    # Swap in a transport that records instead of sending; the scrubber still runs first.
    client = sentry_sdk.get_client()
    client.transport = Capture({})
    yield Capture.sent
    client.close()
    sentry_sdk.init()


def test_an_unhandled_error_is_reported_scrubbed_before_the_response(
    captured: list[dict[str, Any]],
) -> None:
    async def failing_app(scope: Any, receive: Any, send: Any) -> None:
        sentry_sdk.set_context("probe", {"phone": PHONE, "email": EMAIL})
        raise RuntimeError(f"{EMAIL} rang {PHONE}")

    sent: list[dict[str, Any]] = []

    async def collect(message: dict[str, Any]) -> None:
        # Nothing may be left in flight when the 500 is written.
        sent.append({"status": message.get("status"), "events": len(captured)})

    scope = {"type": "http", "method": "GET", "path": "/x", "headers": [], "query_string": b""}
    asyncio.run(UnhandledErrorMiddleware(failing_app)(scope, _receive, collect))  # type: ignore[arg-type]

    assert sent[0]["status"] == 500
    assert sent[0]["events"] == 1  # flushed before the response started
    text = json.dumps(captured[0])
    for leaked in (PHONE, EMAIL):
        assert leaked not in text
    assert "[email]" in text


async def _receive() -> dict[str, Any]:
    return {"type": "http.request", "body": b"", "more_body": False}
