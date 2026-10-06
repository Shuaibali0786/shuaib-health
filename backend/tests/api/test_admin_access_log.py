"""Access-log fields for /api/v1/admin/* (research R16): role and outcome, refusals counted by code,
and never a query string, body, token or personal value."""

import json
import logging
from typing import Any

import pytest
from fastapi.testclient import TestClient

from app.auth import events
from app.main import create_app
from tests.conftest import SettingsFactory

SECRET = "test-proxy-secret-0123456789abcdef"
ME = "/api/v1/admin/auth/me"


def records(capsys: pytest.CaptureFixture[str]) -> list[dict[str, Any]]:
    lines = [ln for ln in capsys.readouterr().err.splitlines() if ln.startswith("{")]
    return [r for r in map(json.loads, lines) if not r["logger"].startswith("httpx")]


def client_for(settings_factory: SettingsFactory) -> TestClient:
    return TestClient(create_app(settings_factory(rate_limit_per_minute=100)))


def test_a_refused_admin_request_logs_role_none_outcome_and_code(
    capsys: pytest.CaptureFixture[str], settings_factory: SettingsFactory
) -> None:
    client = client_for(settings_factory)
    # Wrong proxy secret: refused before any session or database work.
    response = client.get(ME, params={"q": "private-text"}, headers={"X-Proxy-Secret": "x" * 40})
    assert response.status_code == 403

    out = records(capsys)
    access = next(r for r in out if r.get("event") == "request")
    assert (access["status"], access["role"], access["outcome"]) == (403, "none", "refused")
    refused = next(r for r in out if r.get("event") == "request.refused")
    assert refused["code"] == "forbidden"
    assert "private-text" not in json.dumps(out)
    assert all("?" not in r.get("path", "") for r in out)


def test_non_admin_requests_have_no_role_field(
    capsys: pytest.CaptureFixture[str], settings_factory: SettingsFactory
) -> None:
    client_for(settings_factory).get("/health")
    access = next(r for r in records(capsys) if r.get("event") == "request")
    assert "role" not in access and "outcome" not in access


def test_rate_limited_admin_requests_are_counted(
    capsys: pytest.CaptureFixture[str], settings_factory: SettingsFactory
) -> None:
    client = TestClient(create_app(settings_factory(rate_limit_per_minute=1)))
    client.get(ME)
    client.get(ME)
    outcomes = [r["outcome"] for r in records(capsys) if r.get("event") == "request"]
    assert outcomes == ["refused", "rate_limited"]


@pytest.mark.parametrize("event", ["auth.sign_in_failed", "auth.lockout", "demo.started"])
def test_counter_events_carry_only_their_name(
    capsys: pytest.CaptureFixture[str], settings_factory: SettingsFactory, event: str
) -> None:
    create_app(settings_factory())  # installs the JSON log handler
    logging.getLogger("app.auth").setLevel(logging.INFO)
    events.emit(event)  # type: ignore[arg-type]
    emitted = [r for r in records(capsys) if r.get("event") == event]
    assert len(emitted) == 1
    assert set(emitted[0]) <= {"ts", "level", "logger", "msg", "requestId", "event"}
