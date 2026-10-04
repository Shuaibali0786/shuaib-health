"""GET /api/v1/doctors/{slug}/slots on the seeded test database, with a frozen clock."""

from collections.abc import Callable
from datetime import UTC, date, datetime, timedelta
from zoneinfo import ZoneInfo

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, col, select

from app import models as m
from tests.conftest import FROZEN_NOW, FrozenClock, override_clock

pytestmark = pytest.mark.db

KARACHI = ZoneInfo("Asia/Karachi")
SLOTS = "/api/v1/doctors/{slug}/slots"
# Frozen now is Monday 2026-10-05 09:00 Karachi; day offsets in the seed are relative to it.


@pytest.fixture
def slots_client(make_client: Callable[..., TestClient], frozen_clock: FrozenClock) -> TestClient:
    test_client = make_client()
    override_clock(test_client.app, frozen_clock)  # type: ignore[arg-type]
    return test_client


def get_days(client: TestClient, slug: str, **params: object) -> dict[str, object]:
    response = client.get(SLOTS.format(slug=slug), params=params)  # type: ignore[arg-type]
    assert response.status_code == 200, response.text
    body: dict[str, object] = response.json()
    return body


def test_response_shape_and_headers(slots_client: TestClient) -> None:
    response = slots_client.get(SLOTS.format(slug="dr-omar-sheikh"))
    assert response.status_code == 200
    assert response.headers["cache-control"] == "no-store"
    body = response.json()
    assert set(body) == {"doctorSlug", "timeZone", "windowDays", "generatedAt", "days"}
    assert body["doctorSlug"] == "dr-omar-sheikh"
    assert body["timeZone"] == "Asia/Karachi"
    assert body["windowDays"] == 14
    assert body["generatedAt"] == "2026-10-05T04:00:00Z"
    assert len(body["days"]) == 14
    for day in body["days"]:
        assert set(day) <= {"date", "weekday", "status", "holidayName", "slots"}
        for slot in day["slots"]:
            assert set(slot) == {"startsAt", "endsAt", "localTime"}
            assert slot["startsAt"].endswith("Z")


def test_validates_against_the_contract_schema(slots_client: TestClient) -> None:
    schema = slots_client.app.openapi()["components"]["schemas"]  # type: ignore[attr-defined]
    assert {"Slot", "SlotDay", "DoctorSlots"} <= set(schema)


def test_seeded_break_leaves_no_slot_between_17_and_18_on_tuesday(
    slots_client: TestClient,
) -> None:
    body = get_days(slots_client, "dr-omar-sheikh")
    tuesdays = [d for d in body["days"] if d["weekday"] == "tue" and d["status"] == "available"]  # type: ignore[index, union-attr]
    assert tuesdays, "expected at least one working Tuesday in the window"
    for day in tuesdays:
        local_times = [s["localTime"] for s in day["slots"]]
        assert not [t for t in local_times if "17:00" <= t < "18:00"], local_times
        assert any(t < "17:00" for t in local_times)
        assert any(t >= "18:00" for t in local_times)


def test_seeded_leave_day_is_doctor_unavailable(
    slots_client: TestClient, db_session: Session
) -> None:
    leave = db_session.exec(
        select(m.DoctorLeave)
        .join(m.Doctor, col(m.Doctor.id) == col(m.DoctorLeave.doctor_id))
        .where(col(m.Doctor.slug) == "dr-sana-farooqui", col(m.DoctorLeave.is_sample))
    ).all()
    assert leave, "seed should include sample leave for dr-sana-farooqui"
    leave_date = leave[0].starts_at.astimezone(KARACHI).date().isoformat()
    body = get_days(slots_client, "dr-sana-farooqui")
    day = next(d for d in body["days"] if d["date"] == leave_date)  # type: ignore[index, union-attr]
    assert day["status"] == "doctor_unavailable"
    assert day["slots"] == []


def test_seeded_holiday_is_clinic_closed_with_its_name(slots_client: TestClient) -> None:
    body = get_days(slots_client, "dr-omar-sheikh")
    closed = [d for d in body["days"] if d["status"] == "clinic_closed"]  # type: ignore[index, union-attr]
    assert len(closed) == 1
    assert closed[0]["holidayName"] == "Clinic closed (sample holiday)"
    assert closed[0]["slots"] == []


def test_a_confirmed_booking_removes_its_slot(
    slots_client: TestClient, db_session: Session
) -> None:
    doctor = db_session.exec(select(m.Doctor).where(col(m.Doctor.slug) == "dr-omar-sheikh")).one()
    first = next(
        d
        for d in get_days(slots_client, "dr-omar-sheikh")["days"]  # type: ignore[union-attr]
        if d["status"] == "available"
    )
    slot = first["slots"][0]
    starts = datetime.fromisoformat(slot["startsAt"].replace("Z", "+00:00"))
    ends = datetime.fromisoformat(slot["endsAt"].replace("Z", "+00:00"))
    db_session.add(
        m.Appointment(
            reference="ABCDEFGHJK",
            doctor_id=doctor.id,  # type: ignore[arg-type]
            department_id=doctor.department_id,
            starts_at=starts,
            ends_at=ends,
            fee_pkr=doctor.fee_pkr,
            patient_name="Test Patient",
            patient_phone="+923001234567",
            rules_accepted_at=FROZEN_NOW,
            rules_version="0" * 16,
        )
    )
    db_session.flush()
    again = get_days(slots_client, "dr-omar-sheikh")["days"]
    same_day = next(d for d in again if d["date"] == first["date"])  # type: ignore[union-attr]
    assert slot["startsAt"] not in [s["startsAt"] for s in same_day["slots"]]
    assert len(same_day["slots"]) == len(first["slots"]) - 1


def test_from_and_days_parameters(slots_client: TestClient) -> None:
    from_day = (FROZEN_NOW.astimezone(KARACHI).date() + timedelta(days=3)).isoformat()
    body = get_days(slots_client, "dr-omar-sheikh", **{"from": from_day, "days": 2})
    assert body["days"][0]["date"] == from_day  # type: ignore[index]
    assert len(body["days"]) == 2  # type: ignore[arg-type]


def test_unknown_slug_is_404(slots_client: TestClient) -> None:
    response = slots_client.get(SLOTS.format(slug="dr-nobody"))
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "not_found"


def test_inactive_doctor_is_404(slots_client: TestClient, db_session: Session) -> None:
    doctor = db_session.exec(select(m.Doctor).where(col(m.Doctor.slug) == "dr-omar-sheikh")).one()
    doctor.is_active = False
    db_session.add(doctor)
    db_session.flush()
    assert slots_client.get(SLOTS.format(slug="dr-omar-sheikh")).status_code == 404


def test_doctor_in_an_inactive_department_is_404(
    slots_client: TestClient, db_session: Session
) -> None:
    doctor = db_session.exec(select(m.Doctor).where(col(m.Doctor.slug) == "dr-omar-sheikh")).one()
    department = db_session.get(m.Department, doctor.department_id)
    assert department is not None
    department.is_active = False
    db_session.add(department)
    db_session.flush()
    assert slots_client.get(SLOTS.format(slug="dr-omar-sheikh")).status_code == 404


@pytest.mark.parametrize(
    "params",
    [{"days": 0}, {"days": 61}, {"days": "x"}, {"from": "not-a-date"}, {"from": "2026-13-45"}],
)
def test_bad_parameters_are_422(slots_client: TestClient, params: dict[str, object]) -> None:
    response = slots_client.get(SLOTS.format(slug="dr-omar-sheikh"), params=params)  # type: ignore[arg-type]
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "validation_error"


def test_response_never_contains_leave_notes_or_appointment_fields(
    slots_client: TestClient, db_session: Session
) -> None:
    doctor = db_session.exec(select(m.Doctor).where(col(m.Doctor.slug) == "dr-sana-farooqui")).one()
    when = datetime(2026, 10, 7, 5, 0, tzinfo=UTC)
    db_session.add(
        m.DoctorLeave(
            doctor_id=doctor.id,  # type: ignore[arg-type]
            starts_at=when,
            ends_at=when + timedelta(hours=1),
            note="SECRET-LEAVE-NOTE",
        )
    )
    db_session.flush()
    text = slots_client.get(SLOTS.format(slug="dr-sana-farooqui")).text
    assert "SECRET-LEAVE-NOTE" not in text
    for forbidden in ("patient", "reference", "phone", "note", "reason"):
        assert forbidden not in text.lower()


def test_dates_follow_the_clinic_day_not_utc(make_client: Callable[..., TestClient]) -> None:
    # 20:00 UTC on Sunday is 01:00 Monday in Karachi, so today in the clinic is Monday.
    test_client = make_client()
    clock = FrozenClock(datetime(2026, 10, 4, 20, 0, tzinfo=UTC))
    override_clock(test_client.app, clock)  # type: ignore[arg-type]
    body = get_days(test_client, "dr-omar-sheikh")
    assert body["days"][0]["date"] == date(2026, 10, 5).isoformat()  # type: ignore[index]
