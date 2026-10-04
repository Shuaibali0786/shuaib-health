"""POST /api/v1/appointments and GET /api/v1/appointments/{reference} (frozen clock, rolled back).

Frozen "now" is Monday 2026-10-05 09:00 Karachi. ``dr-omar-sheikh`` works Tuesday 14:00-17:00 and
18:00-20:00, so Tuesday 2026-10-06 14:00 Karachi (09:00 UTC) is the first free slot.
"""

import re
import uuid
from collections.abc import Callable
from datetime import UTC, datetime, timedelta
from typing import Any
from zoneinfo import ZoneInfo

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import delete
from sqlmodel import Session, col, select

from app import models as m
from tests.conftest import FROZEN_NOW, FrozenClock, override_clock

pytestmark = pytest.mark.db

SECRET = "test-proxy-secret-0123456789abcdef"  # same value as settings_factory
DOCTOR = "dr-omar-sheikh"
FIRST_SLOT = datetime(2026, 10, 6, 9, 0, tzinfo=UTC)  # Tue 14:00 Karachi
APPOINTMENTS = "/api/v1/appointments"


def iso(value: datetime) -> str:
    return value.strftime("%Y-%m-%dT%H:%M:%SZ")


def body(**over: Any) -> dict[str, Any]:
    values: dict[str, Any] = {
        "doctorSlug": DOCTOR,
        "startsAt": iso(FIRST_SLOT),
        "fullName": "Ali Khan",
        "mobile": "0300 1234567",
        "email": "Ali@Example.com",
        "reason": "Checkup",
        "acceptRules": True,
    }
    values.update(over)
    return values


def headers(**over: str) -> dict[str, str]:
    values = {"X-Proxy-Secret": SECRET, "Idempotency-Key": str(uuid.uuid4())}
    values.update(over)
    return values


@pytest.fixture
def api(make_client: Callable[..., TestClient], frozen_clock: FrozenClock) -> TestClient:
    client = make_client()
    override_clock(client.app, frozen_clock)  # type: ignore[arg-type]
    return client


def book(client: TestClient, **over: Any) -> Any:
    return client.post(APPOINTMENTS, json=body(**over), headers=headers())


def test_success_returns_a_masked_confirmed_booking(api: TestClient, db_session: Session) -> None:
    response = book(api)

    assert response.status_code == 201, response.text
    assert response.headers["cache-control"] == "no-store"
    view = response.json()
    assert re.fullmatch(r"[0-9A-Z]{5}-[0-9A-Z]{5}", view["reference"])
    assert view["status"] == "confirmed"
    assert view["patientNameMasked"] == "A**** K****"
    assert view["mobileMasked"] == "0300****567"
    assert re.fullmatch(r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z", view["bookedAt"])
    assert view["isSample"] is True
    assert view["doctor"]["slug"] == DOCTOR
    assert view["department"]["slug"]
    assert view["startsAt"] == iso(FIRST_SLOT)
    assert view["endsAt"] == iso(FIRST_SLOT + timedelta(minutes=15))
    assert view["localDate"] == "2026-10-06"
    assert view["localTime"] == "14:00"
    assert view["timeZone"] == "Asia/Karachi"
    doctor = db_session.exec(select(m.Doctor).where(col(m.Doctor.slug) == DOCTOR)).one()
    assert view["feePkr"] == doctor.fee_pkr
    assert "email" not in response.text.lower()
    assert "reason" not in view
    assert "Ali Khan" not in response.text
    assert "03001234567" not in response.text
    assert "+923001234567" not in response.text


def test_success_stores_normalized_values_and_server_decided_fields(
    api: TestClient, db_session: Session
) -> None:
    assert book(api).status_code == 201
    row = db_session.exec(select(m.Appointment)).one()
    assert row.patient_phone == "+923001234567"
    assert row.patient_email == "ali@example.com"
    assert row.patient_name == "Ali Khan"
    assert row.reason == "Checkup"
    assert row.status == "confirmed"
    assert row.is_sample is True
    assert row.rules_accepted_at == FROZEN_NOW
    assert re.fullmatch(r"[0-9a-f]{16}", row.rules_version)
    assert row.ends_at - row.starts_at == timedelta(minutes=15)


def test_the_booked_time_disappears_from_the_slots(api: TestClient) -> None:
    def day_times() -> list[str]:
        days = api.get(f"/api/v1/doctors/{DOCTOR}/slots").json()["days"]
        return [s["startsAt"] for d in days if d["date"] == "2026-10-06" for s in d["slots"]]

    assert iso(FIRST_SLOT) in day_times()
    assert book(api).status_code == 201
    assert iso(FIRST_SLOT) not in day_times()


@pytest.mark.parametrize(
    "over",
    [
        {"feePkr": 1},
        {"acceptRules": False},
        {"acceptRules": None},
        {"fullName": "A"},
        {"fullName": "Ali 2"},
        {"mobile": "02134567890"},
        {"email": "nope"},
        {"reason": "x" * 301},
        {"startsAt": "2026-10-06T14:00:00"},
        {"startsAt": "yesterday"},
        {"doctorSlug": "Not A Slug"},
    ],
)
def test_invalid_bodies_are_422(api: TestClient, over: dict[str, Any]) -> None:
    response = book(api, **over)
    assert response.status_code == 422, response.text
    assert response.json()["error"]["code"] == "validation_error"
    assert "Ali Khan" not in response.text


def test_an_unknown_field_is_rejected(api: TestClient) -> None:
    payload = body()
    payload["feePkr"] = 1
    response = api.post(APPOINTMENTS, json=payload, headers=headers())
    assert response.status_code == 422


def test_an_inactive_doctor_is_422_on_the_doctor_field(
    api: TestClient, db_session: Session
) -> None:
    doctor = db_session.exec(select(m.Doctor).where(col(m.Doctor.slug) == DOCTOR)).one()
    doctor.is_active = False
    db_session.add(doctor)
    db_session.flush()
    response = book(api)
    assert response.status_code == 422
    fields = [d["field"] for d in response.json()["error"]["details"]]
    assert fields == ["doctorSlug"]


def test_an_unknown_doctor_is_422_on_the_doctor_field(api: TestClient) -> None:
    response = book(api, doctorSlug="dr-nobody")
    assert response.status_code == 422
    assert response.json()["error"]["details"][0]["field"] == "doctorSlug"


def assert_unavailable_with_alternatives(response: Any, *, at_least: int = 1) -> None:
    assert response.status_code == 409, response.text
    payload = response.json()
    assert payload["error"]["code"] == "slot_unavailable"
    alternatives = payload["alternatives"]
    assert at_least <= len(alternatives) <= 5
    for alternative in alternatives:
        assert set(alternative) == {"startsAt", "endsAt", "localDate", "localTime"}
    starts = [a["startsAt"] for a in alternatives]
    assert starts == sorted(starts)


def test_an_off_grid_time_is_slot_unavailable(api: TestClient) -> None:
    response = book(api, startsAt=iso(FIRST_SLOT + timedelta(minutes=5)))
    assert_unavailable_with_alternatives(response)


def test_a_time_in_the_break_is_slot_unavailable(api: TestClient) -> None:
    response = book(api, startsAt=iso(datetime(2026, 10, 6, 12, 0, tzinfo=UTC)))  # 17:00 Karachi
    assert_unavailable_with_alternatives(response)


def test_a_past_time_is_slot_unavailable(
    make_client: Callable[..., TestClient],
) -> None:
    client = make_client()
    override_clock(client.app, FrozenClock(FIRST_SLOT + timedelta(hours=1)))  # type: ignore[arg-type]
    assert_unavailable_with_alternatives(book(client))


def test_a_time_inside_the_lead_window_is_slot_unavailable(
    make_client: Callable[..., TestClient],
) -> None:
    client = make_client()
    # 13:00 Karachi: the 14:00 slot is only one hour away and the lead time is two hours.
    override_clock(client.app, FrozenClock(FIRST_SLOT - timedelta(hours=1)))  # type: ignore[arg-type]
    assert_unavailable_with_alternatives(book(client))


def test_a_leave_time_is_slot_unavailable(api: TestClient, db_session: Session) -> None:
    doctor = db_session.exec(select(m.Doctor).where(col(m.Doctor.slug) == DOCTOR)).one()
    db_session.add(
        m.DoctorLeave(
            doctor_id=doctor.id,  # type: ignore[arg-type]
            starts_at=FIRST_SLOT - timedelta(minutes=30),
            ends_at=FIRST_SLOT + timedelta(minutes=30),
        )
    )
    db_session.flush()
    assert_unavailable_with_alternatives(book(api))


def test_a_holiday_is_slot_unavailable(api: TestClient, db_session: Session) -> None:
    holiday = FIRST_SLOT.astimezone(ZoneInfo("Asia/Karachi")).date()
    db_session.exec(delete(m.ClinicHoliday).where(col(m.ClinicHoliday.holiday_date) == holiday))  # type: ignore[call-overload]
    db_session.add(m.ClinicHoliday(holiday_date=holiday, name="Test holiday"))
    db_session.flush()
    assert_unavailable_with_alternatives(book(api))


def test_a_time_outside_the_window_is_slot_unavailable(api: TestClient) -> None:
    far = FIRST_SLOT + timedelta(days=14)  # a Tuesday, but past the 14-day window
    assert_unavailable_with_alternatives(book(api, startsAt=iso(far)))


@pytest.mark.parametrize(
    "extra",
    [{}, {"X-Proxy-Secret": "wrong-secret-wrong-secret-wrong-secret"}],
)
def test_a_missing_or_wrong_secret_is_403(api: TestClient, extra: dict[str, str]) -> None:
    sent = {"Idempotency-Key": str(uuid.uuid4()), **extra}
    response = api.post(APPOINTMENTS, json=body(), headers=sent)
    assert response.status_code == 403
    assert response.json()["error"]["code"] == "forbidden"


def test_a_valid_secret_with_a_foreign_origin_is_403(api: TestClient) -> None:
    response = api.post(APPOINTMENTS, json=body(), headers=headers(Origin="https://evil.example"))
    assert response.status_code == 403


def test_lookup_returns_the_masked_view_in_any_reference_spelling(api: TestClient) -> None:
    reference = book(api).json()["reference"]
    plain = reference.replace("-", "")
    for spelling in (reference, plain, plain.lower(), reference.lower()):
        response = api.get(f"{APPOINTMENTS}/{spelling}")
        assert response.status_code == 200, spelling
        assert response.headers["cache-control"] == "no-store"
        view = response.json()
        assert view["reference"] == reference
        assert view["patientNameMasked"] == "A**** K****"
        assert view["mobileMasked"] == "0300****567"
        assert "email" not in response.text.lower()
        assert "reason" not in view


def test_unknown_and_malformed_references_get_the_same_404(api: TestClient) -> None:
    unknown = api.get(f"{APPOINTMENTS}/ZZZZZ-ZZZZZ")
    malformed = api.get(f"{APPOINTMENTS}/not-a-reference")
    assert unknown.status_code == malformed.status_code == 404

    def strip(response: Any) -> Any:
        error = response.json()["error"]
        return {k: v for k, v in error.items() if k != "requestId"}

    assert strip(unknown) == strip(malformed)
    assert unknown.headers["cache-control"] == "no-store"


def test_the_audit_log_records_the_booking_without_personal_data(
    api: TestClient, db_session: Session
) -> None:
    response = api.post(
        APPOINTMENTS, json=body(), headers=headers(**{"X-Request-ID": "req-audit-1"})
    )
    assert response.status_code == 201
    row = db_session.exec(select(m.Appointment)).one()
    audit = db_session.exec(select(m.AuditLog)).one()
    assert audit.action == "appointment.created"
    assert audit.outcome == "ok"
    assert audit.target_type == "appointment"
    assert audit.target_id == row.id
    assert re.fullmatch(r"[0-9a-f]{16}", audit.actor_fingerprint)
    assert audit.request_id
    dumped = repr(audit.model_dump())
    for personal in ("Ali", "Khan", "3001234567", "example.com", "Checkup"):
        assert personal not in dumped


def test_a_reference_collision_is_retried_once(
    api: TestClient, db_session: Session, monkeypatch: pytest.MonkeyPatch
) -> None:
    assert book(api).status_code == 201
    taken = db_session.exec(select(m.Appointment.reference)).one()
    fresh = "0123456789"
    references = iter([taken, fresh])
    monkeypatch.setattr("app.booking.service.new_reference", lambda: next(references))

    second = book(api, startsAt=iso(FIRST_SLOT + timedelta(minutes=15)), mobile="0345 1234567")

    assert second.status_code == 201, second.text
    assert second.json()["reference"] == "01234-56789"
