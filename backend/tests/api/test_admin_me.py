"""GET /admin/auth/me and the session/throttle core it sits on (sessions are created directly:
the sign-in endpoint belongs to the next story)."""

from collections.abc import Callable
from datetime import date, timedelta
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, col, select

from app import models as m
from app.auth import sessions, throttle, tokens
from app.auth.passwords import hash_password
from app.settings import Settings
from tests.conftest import FROZEN_NOW, FrozenClock, SettingsFactory, override_clock

pytestmark = pytest.mark.db

SECRET = "test-proxy-secret-0123456789abcdef"
HASH = hash_password("Tr1cky-Horse-Battery")
ME = "/api/v1/admin/auth/me"
FP = "f" * 16


@pytest.fixture
def settings(settings_factory: SettingsFactory) -> Settings:
    return settings_factory()


@pytest.fixture
def clock() -> FrozenClock:
    return FrozenClock(FROZEN_NOW)


@pytest.fixture
def admin_client(make_client: Callable[..., TestClient], clock: FrozenClock) -> TestClient:
    client = make_client()
    override_clock(client.app, clock)  # type: ignore[arg-type]
    return client


def make_staff(
    db: Session, email: str = "owner@example.org", role: str = "admin", **kw: Any
) -> m.StaffAccount:
    staff = m.StaffAccount(
        email=email, display_name="Clinic Owner", role=role, password_hash=HASH, **kw
    )
    db.add(staff)
    db.flush()
    return staff


def headers(token: str | None = None, **extra: str) -> dict[str, str]:
    values = {"X-Proxy-Secret": SECRET, **extra}
    if token:
        values["X-Session-Token"] = token
    return values


def staff_token(db: Session, settings: Settings, clock: FrozenClock) -> str:
    return sessions.create_staff_session(db, settings, make_staff(db), FP, clock.now())[0]


def test_staff_session_returns_the_viewer(
    admin_client: TestClient, db_session: Session, settings: Settings, clock: FrozenClock
) -> None:
    token, row = sessions.create_staff_session(
        db_session, settings, make_staff(db_session), FP, clock.now()
    )
    response = admin_client.get(ME, headers=headers(token))
    assert response.status_code == 200
    body = response.json()
    assert body["kind"] == "staff" and body["role"] == "admin"
    assert body["displayName"] == "Clinic Owner" and body["mustChangePassword"] is False
    assert body["timezone"] == "Asia/Karachi" and body["clinicToday"] == "2026-10-05"
    assert body["csrfToken"] == tokens.csrf_token(settings.session_secret, row.id)  # type: ignore[arg-type]
    assert "token" not in body
    assert response.headers["cache-control"] == "no-store"


def test_demo_session_returns_the_demo_date(
    admin_client: TestClient, db_session: Session, settings: Settings, clock: FrozenClock
) -> None:
    token, _ = sessions.create_demo_session(
        db_session, settings, date(2026, 10, 3), FP, clock.now()
    )
    body = admin_client.get(ME, headers=headers(token)).json()
    assert body["kind"] == "demo" and body["clinicToday"] == "2026-10-03"
    assert "role" not in body and "displayName" not in body


@pytest.mark.parametrize("token", [None, "", "garbage", "cs_unknown-token-value", "cd_unknown"])
def test_missing_or_unknown_tokens_are_401(admin_client: TestClient, token: str | None) -> None:
    response = admin_client.get(ME, headers=headers(token))
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "not_signed_in"


def test_missing_proxy_secret_and_foreign_origin_are_403(
    admin_client: TestClient, db_session: Session, settings: Settings, clock: FrozenClock
) -> None:
    token = staff_token(db_session, settings, clock)
    assert admin_client.get(ME, headers={"X-Session-Token": token}).status_code == 403
    foreign = headers(token, Origin="https://evil.example")
    assert admin_client.get(ME, headers=foreign).status_code == 403


def test_idle_expiry_ends_the_session_and_audits_once(
    admin_client: TestClient, db_session: Session, settings: Settings, clock: FrozenClock
) -> None:
    token = staff_token(db_session, settings, clock)
    clock.set(clock.now() + timedelta(minutes=31))
    first = admin_client.get(ME, headers=headers(token))
    assert (first.status_code, first.json()["error"]["code"]) == (401, "session_expired")
    again = admin_client.get(ME, headers=headers(token))
    assert (again.status_code, again.json()["error"]["code"]) == (401, "not_signed_in")
    rows = db_session.exec(
        select(m.AuditLog).where(col(m.AuditLog.action) == "auth.session_expired")
    ).all()
    assert len(rows) == 1 and rows[0].actor_type == "staff" and rows[0].actor_staff_id is not None


def test_absolute_expiry_after_twelve_hours_even_when_active(
    admin_client: TestClient, db_session: Session, settings: Settings, clock: FrozenClock
) -> None:
    token = staff_token(db_session, settings, clock)
    while clock.now() - FROZEN_NOW < timedelta(hours=12):
        clock.set(clock.now() + timedelta(minutes=29))  # a request every 29 minutes
        if clock.now() - FROZEN_NOW >= timedelta(hours=12):
            break
        assert admin_client.get(ME, headers=headers(token)).status_code == 200
    assert admin_client.get(ME, headers=headers(token)).status_code == 401
    assert db_session.exec(select(m.StaffSession)).one().end_reason == "absolute"


def test_last_seen_slides_at_most_once_a_minute(
    admin_client: TestClient, db_session: Session, settings: Settings, clock: FrozenClock
) -> None:
    token, row = sessions.create_staff_session(
        db_session, settings, make_staff(db_session), FP, clock.now()
    )
    clock.set(clock.now() + timedelta(seconds=30))
    admin_client.get(ME, headers=headers(token))
    db_session.refresh(row)
    assert row.last_seen_at == FROZEN_NOW
    clock.set(clock.now() + timedelta(seconds=31))
    admin_client.get(ME, headers=headers(token))
    db_session.refresh(row)
    assert row.last_seen_at == clock.now()
    assert row.idle_expires_at == clock.now() + timedelta(minutes=30)


def test_a_fourth_session_evicts_the_oldest(
    admin_client: TestClient, db_session: Session, settings: Settings, clock: FrozenClock
) -> None:
    staff = make_staff(db_session)
    issued = [
        sessions.create_staff_session(
            db_session, settings, staff, FP, clock.now() + timedelta(minutes=minute)
        )[0]
        for minute in range(4)
    ]
    clock.set(clock.now() + timedelta(minutes=4))
    codes = [admin_client.get(ME, headers=headers(t)).status_code for t in issued]
    assert codes == [401, 200, 200, 200]


def test_a_deactivated_account_is_signed_out_at_once(
    admin_client: TestClient, db_session: Session, settings: Settings, clock: FrozenClock
) -> None:
    staff = make_staff(db_session)
    token, _ = sessions.create_staff_session(db_session, settings, staff, FP, clock.now())
    staff.is_active = False
    db_session.flush()
    assert admin_client.get(ME, headers=headers(token)).status_code == 401


def test_a_demo_token_with_a_staff_prefix_is_not_a_staff_session(
    admin_client: TestClient, db_session: Session, settings: Settings, clock: FrozenClock
) -> None:
    token, _ = sessions.create_demo_session(
        db_session, settings, date(2026, 10, 3), FP, clock.now()
    )
    swapped = "cs_" + token.removeprefix("cd_")
    assert admin_client.get(ME, headers=headers(swapped)).status_code == 401


def test_a_demo_session_ends_after_two_hours(
    admin_client: TestClient, db_session: Session, settings: Settings, clock: FrozenClock
) -> None:
    token, _ = sessions.create_demo_session(
        db_session, settings, date(2026, 10, 3), FP, clock.now()
    )
    clock.set(clock.now() + timedelta(hours=2, minutes=1))
    assert admin_client.get(ME, headers=headers(token)).status_code == 401


def test_throttle_locks_at_five_failures_and_clears_on_success(
    db_session: Session, settings: Settings
) -> None:
    subject = throttle.subject_hash(settings.privacy_hash_key, " Owner@Example.org ")
    assert subject == throttle.subject_hash(settings.privacy_hash_key, "owner@example.org")
    now = FROZEN_NOW
    for failure in range(1, 5):
        assert throttle.record_failure(db_session, settings, subject, now) is False, failure
    assert throttle.locked_for(db_session, subject, now) is None
    assert throttle.record_failure(db_session, settings, subject, now) is True
    assert throttle.locked_for(db_session, subject, now) == 15 * 60
    assert throttle.locked_for(db_session, subject, now + timedelta(minutes=14)) == 60
    assert throttle.locked_for(db_session, subject, now + timedelta(minutes=15)) is None
    throttle.clear(db_session, subject)
    assert throttle.locked_for(db_session, subject, now) is None


def test_failures_outside_the_fifteen_minute_window_start_over(
    db_session: Session, settings: Settings
) -> None:
    subject = throttle.subject_hash(settings.privacy_hash_key, "slow@example.org")
    for _ in range(4):
        throttle.record_failure(db_session, settings, subject, FROZEN_NOW)
    later = FROZEN_NOW + timedelta(minutes=16)
    assert throttle.record_failure(db_session, settings, subject, later) is False
    assert throttle.locked_for(db_session, subject, later) is None


def test_audit_rows_have_no_free_text_columns() -> None:
    columns = {c.name for c in m.AuditLog.__table__.columns}  # type: ignore[attr-defined]
    assert not columns & {"email", "password", "phone", "patient_name", "reason", "note", "message"}
