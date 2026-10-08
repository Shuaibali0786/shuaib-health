import json
import logging
import uuid
from collections.abc import Callable
from datetime import timedelta
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlmodel import Session, col, select

from app import models as m
from app.main import create_app
from app.settings import Settings
from tests.api.admin_support import API, PASSWORD, make_staff, sign_in, staff_session
from tests.conftest import FrozenClock, SettingsFactory, override_clock

SECRET_URL = "postgresql+psycopg://appuser:SECRETPW@ep-x.example.neon.tech/db?sslmode=require"


def log_records(capsys: pytest.CaptureFixture[str]) -> list[dict[str, Any]]:
    lines = [ln for ln in capsys.readouterr().err.splitlines() if ln.startswith("{")]
    records = [json.loads(ln) for ln in lines]
    # The in-process test client logs its own outgoing request URL (with the query string);
    # that is not server output, so it is not part of what is being checked.
    return [r for r in records if not r["logger"].startswith("httpx")]


def test_logs_have_no_query_strings_urls_or_secrets(
    capsys: pytest.CaptureFixture[str], settings_factory: SettingsFactory
) -> None:
    app = create_app(settings_factory(rate_limit_per_minute=100))

    @app.get("/boom")
    def boom() -> None:
        raise RuntimeError(f"cannot connect to {SECRET_URL}")

    client = TestClient(app, raise_server_exceptions=False)
    client.get("/api/v1/nope", params={"q": "private-text", "pageSize": 5})
    client.get("/health")
    assert client.get("/boom").status_code == 500

    records = log_records(capsys)
    raw = json.dumps(records)
    for forbidden in ("private-text", "SECRETPW", "appuser", "ep-x.example", "pageSize"):
        assert forbidden not in raw
    assert "postgresql://***" in raw  # the redaction ran on the logged exception

    access = [r for r in records if r.get("event") == "request"]
    assert len(access) == 3
    for record in access:
        assert {"requestId", "method", "path", "status", "durationMs"} <= record.keys()
        assert "?" not in record["path"]
        assert record["requestId"] != "-"
    assert {r["status"] for r in access} == {404, 200, 500}


def test_every_log_line_is_valid_json(
    capsys: pytest.CaptureFixture[str], settings_factory: SettingsFactory
) -> None:
    client = TestClient(create_app(settings_factory()))
    client.get("/health")
    out = capsys.readouterr().err.strip().splitlines()
    assert out
    for line in out:
        assert isinstance(json.loads(line), dict)


# ---- Booking flow (FR-051, FR-053): no personal data in logs, errors or stored audit rows ----

BOOKING_SECRET = "test-proxy-secret-0123456789abcdef"
PERSONAL = {
    "name": "Zubair Testcase",
    "mobile_raw": "03123456789",
    "mobile_e164": "+923123456789",
    "email": "zubair.testcase@example.com",
    "reason": "private-reason-text",
}


def booking_body(**over: Any) -> dict[str, Any]:
    values: dict[str, Any] = {
        "doctorSlug": "dr-omar-sheikh",
        "startsAt": "2026-10-06T09:00:00Z",
        "fullName": PERSONAL["name"],
        "mobile": PERSONAL["mobile_raw"],
        "email": PERSONAL["email"],
        "reason": PERSONAL["reason"],
        "acceptRules": True,
    }
    values.update(over)
    return values


def booking_headers() -> dict[str, str]:
    return {"X-Proxy-Secret": BOOKING_SECRET, "Idempotency-Key": str(uuid.uuid4())}


@pytest.mark.db
def test_booking_traffic_leaves_no_personal_data_in_logs_errors_or_rows(
    make_client: Callable[..., TestClient],
    frozen_clock: FrozenClock,
    db_session: Session,
    capsys: pytest.CaptureFixture[str],
    caplog: pytest.LogCaptureFixture,
) -> None:
    client = make_client(booking_limit_per_ip_per_hour=3)
    override_clock(client.app, frozen_clock)  # type: ignore[arg-type]
    url = "/api/v1/appointments"
    bodies: list[str] = []

    with caplog.at_level(logging.DEBUG):
        created = client.post(url, json=booking_body(), headers=booking_headers())
        assert created.status_code == 201
        reference = created.json()["reference"]
        bodies.append(created.text)
        # Same slot, another person: slot-taken.
        taken = client.post(
            url,
            json=booking_body(mobile="03123456780", fullName="Zubair Second"),
            headers=booking_headers(),
        )
        assert taken.status_code == 409
        bodies.append(taken.text)
        invalid = client.post(url, json=booking_body(mobile="12345"), headers=booking_headers())
        assert invalid.status_code == 422
        bodies.append(invalid.text)
        trapped = client.post(url, json=booking_body(trap="x"), headers=booking_headers())
        assert trapped.status_code == 400
        bodies.append(trapped.text)
        limited = client.post(url, json=booking_body(), headers=booking_headers())
        assert limited.status_code == 429
        bodies.append(limited.text)
        found = client.get(f"{url}/{reference}")
        assert found.status_code == 200
        bodies.append(found.text)

    logged = json.dumps(log_records(capsys)) + "\n".join(r.getMessage() for r in caplog.records)
    # Error bodies may only carry masked forms (the confirmation view masks name and mobile).
    errors = "\n".join(bodies[1:5])
    for label, value in PERSONAL.items():
        assert value not in logged, f"{label} found in logs"
        assert value not in errors, f"{label} found in an error body"

    stored = (
        db_session.connection()
        .execute(
            text(
                "SELECT (SELECT coalesce(string_agg(a::text, ' '), '') FROM audit_log a) || "
                "(SELECT coalesce(string_agg(i::text, ' '), '') FROM idempotency_key i)"
            )
        )
        .scalar_one()
    )
    counters = (
        db_session.connection()
        .execute(text("SELECT coalesce(string_agg(r::text, ' '), '') FROM rate_limit_counter r"))
        .scalar_one()
    )
    for label, value in PERSONAL.items():
        assert value not in stored, f"{label} found in audit/idempotency rows"
        assert value not in counters, f"{label} found in rate-limit rows"


# ---- Command Centre (Feature 006, SC-008): no patient data, search term, password or token ----


@pytest.mark.db
def test_command_centre_traffic_leaves_no_personal_data_passwords_or_tokens_in_logs(
    cc_client: TestClient,
    cc_settings: Settings,
    cc_clock: FrozenClock,
    db_session: Session,
    capsys: pytest.CaptureFixture[str],
    caplog: pytest.LogCaptureFixture,
) -> None:
    admin = make_staff(db_session, "owner.logcheck@example.org", "admin", "Owner Logcheck")
    hdrs, token, _ = staff_session(db_session, cc_settings, admin, cc_clock.now())
    doc = db_session.exec(select(m.Doctor).where(col(m.Doctor.slug) == "dr-omar-sheikh")).one()
    starts = cc_clock.now() + timedelta(hours=1, minutes=30)
    db_session.add(
        m.Appointment(
            reference="ZZZZZKK001",
            doctor_id=doc.id,  # type: ignore[arg-type]
            department_id=doc.department_id,
            starts_at=starts,
            ends_at=starts + timedelta(minutes=15),
            status="confirmed",
            fee_pkr=doc.fee_pkr,
            patient_name=PERSONAL["name"],
            patient_phone=PERSONAL["mobile_e164"],
            patient_email=PERSONAL["email"],
            reason=PERSONAL["reason"],
            rules_accepted_at=cc_clock.now(),
            rules_version="0" * 16,
        )
    )
    db_session.commit()
    temporary = "Temporary-Pass-Phrase-42"
    new_password = "Brand-New-Passphrase-99"
    wrong = "Wrong-Guess-Password-1"
    searched = ["Zubair Test", "3123456789", "zubair.testcase"]

    with caplog.at_level(logging.DEBUG):
        assert sign_in(cc_client, admin.email, wrong).status_code == 401
        assert sign_in(cc_client, admin.email).status_code == 200
        for term in searched:
            found = cc_client.post(f"{API}/bookings/search", json={"q": term}, headers=hdrs)
            assert found.status_code == 200
        assert cc_client.get(f"{API}/bookings/ZZZZZKK001", headers=hdrs).status_code == 200
        reveal = cc_client.post(f"{API}/bookings/ZZZZZKK001/reveal-phone", headers=hdrs)
        assert reveal.status_code == 200
        arrived = cc_client.post(
            f"{API}/bookings/ZZZZZKK001/status",
            json={"to": "arrived", "expectedVersion": 1},
            headers=hdrs,
        )
        assert arrived.status_code == 200
        created = cc_client.post(
            f"{API}/staff",
            json={
                "email": "new.desk@example.org",
                "displayName": "New Desk",
                "role": "receptionist",
                "temporaryPassword": temporary,
            },
            headers=hdrs,
        )
        assert created.status_code == 201
        reset = cc_client.post(
            f"{API}/staff/{created.json()['id']}/reset-password",
            json={"temporaryPassword": temporary + "x"},
            headers=hdrs,
        )
        assert reset.status_code in (200, 204)
        changed = cc_client.post(
            f"{API}/auth/change-password",
            json={"currentPassword": PASSWORD, "newPassword": new_password},
            headers=hdrs,
        )
        assert changed.status_code in (200, 204)
        # Refused requests (no proxy secret; malformed body or ended session) are logged too.
        no_secret = cc_client.get(f"{API}/bookings/ZZZZZKK001", headers={"X-Session-Token": token})
        assert 400 <= no_secret.status_code < 500
        malformed = cc_client.post(f"{API}/bookings/search", json={"q": 5}, headers=hdrs)
        assert 400 <= malformed.status_code < 500

    logged = json.dumps(log_records(capsys)) + "\n".join(r.getMessage() for r in caplog.records)
    assert logged  # the requests really were logged
    secrets_and_terms = {
        **PERSONAL,
        "token": token,
        "csrf": hdrs["X-CSRF-Token"],
        "password": PASSWORD,
        "wrong password": wrong,
        "new password": new_password,
        "temporary password": temporary,
        **{f"search term {i}": term for i, term in enumerate(searched)},
    }
    for label, value in secrets_and_terms.items():
        assert value not in logged, f"{label} found in logs"
