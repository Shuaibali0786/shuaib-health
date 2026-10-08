"""POST /admin/demo/start: a read-only, two-hour, per-IP-limited session, never staff."""

import logging
from collections.abc import Callable
from datetime import timedelta

import pytest
from fastapi.testclient import TestClient
from httpx2 import Response
from sqlmodel import Session, select

from app import models as m
from app.settings import Settings
from tests.api.admin_support import (
    API,
    csrf_for,
    error_code,
    headers,
    make_staff,
    sign_in,
    staff_session,
)
from tests.conftest import FROZEN_NOW, FrozenClock, override_clock

pytestmark = pytest.mark.db


def start(client: TestClient, **extra: str) -> Response:
    return client.post(f"{API}/demo/start", headers=headers(**extra))


def test_start_issues_a_demo_session(
    cc_client: TestClient, db_session: Session, cc_settings: Settings
) -> None:
    response = start(cc_client)
    assert response.status_code == 200
    assert response.headers["cache-control"] == "no-store"
    body = response.json()
    assert body["token"].startswith("cd_")
    viewer = body["viewer"]
    assert viewer["kind"] == "demo" and "role" not in viewer and "displayName" not in viewer
    assert viewer["clinicToday"] == "2026-10-05" and viewer["timezone"] == "Asia/Karachi"
    row = db_session.exec(select(m.DemoSession)).one()
    assert row.demo_date.isoformat() == "2026-10-05"
    assert row.expires_at - FROZEN_NOW == timedelta(hours=2)
    assert viewer["csrfToken"] == csrf_for(cc_settings, row.id)
    assert viewer["sessionExpiresAt"].startswith("2026-10-05T06:00:00")
    me = cc_client.get(f"{API}/auth/me", headers=headers(body["token"]))
    assert me.status_code == 200 and me.json()["kind"] == "demo"


def test_demo_date_is_the_karachi_date(
    cc_client: TestClient, cc_clock: FrozenClock, db_session: Session
) -> None:
    cc_clock._now = FROZEN_NOW.replace(hour=20, minute=30)  # 01:30 on 6 Oct in Karachi
    assert start(cc_client).json()["viewer"]["clinicToday"] == "2026-10-06"


def test_the_demo_expires_after_two_hours(cc_client: TestClient, cc_clock: FrozenClock) -> None:
    token = start(cc_client).json()["token"]
    cc_clock._now = FROZEN_NOW + timedelta(hours=2, seconds=1)
    response = cc_client.get(f"{API}/auth/me", headers=headers(token))
    assert response.status_code == 401 and error_code(response) == "session_expired"


def test_a_demo_token_never_authenticates_as_staff(cc_client: TestClient) -> None:
    token = start(cc_client).json()["token"]
    swapped = "cs_" + token.removeprefix("cd_")
    response = cc_client.get(f"{API}/auth/me", headers=headers(swapped))
    assert response.status_code == 401 and error_code(response) == "not_signed_in"


def test_the_per_ip_limit_answers_429(
    make_client: Callable[..., TestClient],
    cc_clock: FrozenClock,
    db_session: Session,
) -> None:
    client = make_client(demo_limit_per_ip_per_hour=2)
    override_clock(client.app, cc_clock)  # type: ignore[arg-type]
    mine = {"X-Client-IP": "203.0.113.7"}
    assert start(client, **mine).status_code == 200
    assert start(client, **mine).status_code == 200
    third = start(client, **mine)
    assert third.status_code == 429 and error_code(third) == "rate_limited"
    assert int(third.headers["retry-after"]) > 0
    assert start(client, **{"X-Client-IP": "203.0.113.8"}).status_code == 200


def test_sign_in_replaces_a_demo_session(
    cc_client: TestClient, cc_clock: FrozenClock, db_session: Session
) -> None:
    make_staff(db_session)
    demo = start(cc_client).json()["token"]
    cc_clock._now = FROZEN_NOW + timedelta(seconds=1)
    assert sign_in(cc_client, "owner@example.org", **{"X-Session-Token": demo}).status_code == 200
    assert cc_client.get(f"{API}/auth/me", headers=headers(demo)).status_code == 401


def test_demo_start_ends_a_staff_session(
    cc_client: TestClient, db_session: Session, cc_settings: Settings, cc_clock: FrozenClock
) -> None:
    staff = make_staff(db_session)
    _, token, row = staff_session(db_session, cc_settings, staff, cc_clock.now())
    assert start(cc_client, **{"X-Session-Token": token}).status_code == 200
    db_session.expire_all()
    ended = db_session.get(m.StaffSession, row.id)
    assert ended is not None and ended.end_reason == "replaced"
    assert cc_client.get(f"{API}/auth/me", headers=headers(token)).status_code == 401


def test_no_audit_rows_and_a_structured_log(
    cc_client: TestClient, db_session: Session, caplog: pytest.LogCaptureFixture
) -> None:
    with caplog.at_level(logging.INFO, logger="app.auth"):
        assert start(cc_client).status_code == 200
    assert db_session.exec(select(m.AuditLog)).all() == []
    assert [r.getMessage() for r in caplog.records if r.name == "app.auth"] == ["demo.started"]


def test_the_proxy_secret_is_required(cc_client: TestClient) -> None:
    assert cc_client.post(f"{API}/demo/start").status_code == 403


def test_demo_is_refused_staff_only_actions(
    cc_client: TestClient, db_session: Session, cc_settings: Settings
) -> None:
    body = start(cc_client).json()
    row = db_session.exec(select(m.DemoSession)).one()
    hdrs = headers(body["token"], csrf_for(cc_settings, row.id))
    response = cc_client.post(
        f"{API}/auth/change-password",
        json={"currentPassword": "x", "newPassword": "y" * 14},
        headers=hdrs,
    )
    assert response.status_code == 403 and error_code(response) == "demo_read_only"
