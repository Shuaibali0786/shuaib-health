"""Command Centre bookings (US4): search, detail, status changes, undo, phone reveal and lookups.

Most tests share the rolled-back ``db_session``; the transaction and race tests use a committing
engine so the rows are really committed, like in production. Time is the frozen 005 clock:
Monday 2026-10-05 09:00 in Karachi.
"""

import threading
import uuid
from collections import Counter
from collections.abc import Callable, Iterator
from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime, timedelta
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import Engine, text
from sqlmodel import Session, col, select

from app import models as m
from app.auth import sessions
from app.demo.generator import get_dataset
from app.settings import Settings
from tests.api.admin_support import (
    API,
    FP,
    csrf_for,
    error_code,
    headers,
    make_staff,
    staff_session,
)
from tests.conftest import FROZEN_NOW, FrozenClock

pytestmark = pytest.mark.db

NOON = datetime(2026, 10, 5, 7, 0, tzinfo=UTC)  # 12:00 Karachi, three hours after "now"
SOON = FROZEN_NOW + timedelta(hours=1, minutes=30)  # inside the two hours before the start


def doctor(db: Session, slug: str = "dr-omar-sheikh") -> m.Doctor:
    return db.exec(select(m.Doctor).where(col(m.Doctor.slug) == slug)).one()


def seed(
    db: Session,
    ref: str,
    starts_at: datetime = NOON,
    *,
    name: str = "Ayesha Khan",
    phone: str = "+923001234567",
    email: str | None = "ayesha@example.com",
    status: str = "confirmed",
    slug: str = "dr-omar-sheikh",
    commit: bool = True,
) -> m.Appointment:
    doc = doctor(db, slug)
    row = m.Appointment(
        reference=ref,
        doctor_id=doc.id,  # type: ignore[arg-type]
        department_id=doc.department_id,
        starts_at=starts_at,
        ends_at=starts_at + timedelta(minutes=15),
        status=status,
        fee_pkr=doc.fee_pkr,
        patient_name=name,
        patient_phone=phone,
        patient_email=email,
        reason="Annual check-up",
        rules_accepted_at=FROZEN_NOW,
        rules_version="0" * 16,
    )
    db.add(row)
    db.flush()
    if commit:
        db.commit()  # keeps the row when the service rolls back to refresh a conflict
    return row


@pytest.fixture
def staff_headers(
    db_session: Session, cc_settings: Settings, cc_clock: FrozenClock
) -> tuple[dict[str, str], m.StaffAccount]:
    staff = make_staff(db_session, "desk@example.org", "receptionist", "Desk Person")
    hdrs, _, _ = staff_session(db_session, cc_settings, staff, cc_clock.now())
    db_session.commit()
    return hdrs, staff


@pytest.fixture
def demo_headers(
    db_session: Session, cc_settings: Settings, cc_clock: FrozenClock
) -> dict[str, str]:
    token, row = sessions.create_demo_session(
        db_session, cc_settings, cc_clock.now().date(), FP, cc_clock.now()
    )
    db_session.commit()
    return headers(token, csrf_for(cc_settings, row.id))


def search(client: TestClient, hdrs: dict[str, str], **body: Any) -> Any:
    return client.post(f"{API}/bookings/search", json=body, headers=hdrs)


def change(client: TestClient, hdrs: dict[str, str], ref: str, to: str, version: int) -> Any:
    return client.post(
        f"{API}/bookings/{ref}/status", json={"to": to, "expectedVersion": version}, headers=hdrs
    )


def audit_rows(db: Session, action: str) -> list[m.AuditLog]:
    db.expire_all()
    return list(db.exec(select(m.AuditLog).where(col(m.AuditLog.action) == action)).all())


# ----- search and detail (T087) ---------------------------------------------------------------


def test_search_by_partial_reference_and_by_name_ignores_case(
    cc_client: TestClient, db_session: Session, staff_headers: tuple[dict[str, str], Any]
) -> None:
    hdrs, _ = staff_headers
    seed(db_session, "AAAAAKK001", name="Ayesha Khan")
    seed(db_session, "BBBBBMM002", NOON + timedelta(minutes=15), name="Bilal Raza")
    by_ref = search(cc_client, hdrs, q="akk0").json()
    assert [b["reference"] for b in by_ref["items"]] == ["AAAAAKK001"]
    by_name = search(cc_client, hdrs, q="BILAL r").json()
    assert [b["reference"] for b in by_name["items"]] == ["BBBBBMM002"]


def test_percent_underscore_and_backslash_are_literal(
    cc_client: TestClient, db_session: Session, staff_headers: tuple[dict[str, str], Any]
) -> None:
    hdrs, _ = staff_headers
    seed(db_session, "AAAAAAAA01", name="Zed_Q")
    seed(db_session, "AAAAAAAA02", NOON + timedelta(minutes=15), name="ZedXQ")
    seed(db_session, "AAAAAAAA03", NOON + timedelta(minutes=30), name="Back\\slash 100%")
    assert [b["reference"] for b in search(cc_client, hdrs, q="d_q").json()["items"]] == [
        "AAAAAAAA01"
    ]
    assert search(cc_client, hdrs, q="%").json()["total"] == 1
    assert [b["reference"] for b in search(cc_client, hdrs, q="\\").json()["items"]] == [
        "AAAAAAAA03"
    ]


def test_filters_by_date_doctor_department_and_status_with_counts(
    cc_client: TestClient, db_session: Session, staff_headers: tuple[dict[str, str], Any]
) -> None:
    hdrs, _ = staff_headers
    other = doctor(db_session, "dr-sana-farooqui")
    seed(db_session, "AAAAAAAA01", NOON, status="completed")
    seed(db_session, "AAAAAAAA02", NOON + timedelta(minutes=15))
    seed(db_session, "AAAAAAAA03", NOON, slug="dr-sana-farooqui", status="cancelled")
    seed(db_session, "AAAAAAAA04", NOON + timedelta(days=1))
    today = search(cc_client, hdrs).json()  # default: today
    assert today["total"] == 3 and today["pageSize"] == 20
    assert today["statusCounts"] == {"completed": 1, "confirmed": 1, "cancelled": 1}
    both_days = search(cc_client, hdrs, **{"from": "2026-10-05", "to": "2026-10-06"}).json()
    assert both_days["total"] == 4
    only_doctor = search(cc_client, hdrs, doctorId=str(other.id)).json()
    assert [b["reference"] for b in only_doctor["items"]] == ["AAAAAAAA03"]
    only_department = search(cc_client, hdrs, departmentId=str(other.department_id)).json()
    assert {b["reference"] for b in only_department["items"]} >= {"AAAAAAAA03"}
    cancelled = search(cc_client, hdrs, statuses=["cancelled"]).json()
    assert [b["reference"] for b in cancelled["items"]] == ["AAAAAAAA03"]
    # the chips ignore the status filter, so they still show the day's mix
    assert cancelled["statusCounts"] == today["statusCounts"]


def test_pages_of_twenty_with_a_total(
    cc_client: TestClient, db_session: Session, staff_headers: tuple[dict[str, str], Any]
) -> None:
    hdrs, _ = staff_headers
    for i in range(25):
        seed(db_session, f"AAAAAA{i:04d}", NOON + timedelta(minutes=15 * i), commit=False)
    db_session.commit()
    first = search(cc_client, hdrs, **{"from": "2026-10-05", "to": "2026-10-05"}).json()
    second = search(cc_client, hdrs, page=2).json()
    assert (len(first["items"]), first["total"], len(second["items"])) == (20, 25, 5)
    assert search(cc_client, hdrs, page=9).json()["items"] == []


@pytest.mark.parametrize(
    "body",
    [
        {"q": "x" * 81},
        {"from": "2026-01-01", "to": "2026-06-01"},
        {"from": "2026-10-06", "to": "2026-10-05"},
        {"page": 0},
        {"statuses": ["nope"]},
        {"doctorId": "not-a-uuid"},
    ],
)
def test_invalid_searches_are_422(
    cc_client: TestClient, staff_headers: tuple[dict[str, str], Any], body: dict[str, Any]
) -> None:
    response = search(cc_client, staff_headers[0], **body)
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "validation_error"


def test_detail_has_history_allowed_next_and_masked_contact(
    cc_client: TestClient, db_session: Session, staff_headers: tuple[dict[str, str], Any]
) -> None:
    hdrs, _ = staff_headers
    seed(db_session, "AAAAAAAA01", SOON)
    body = cc_client.get(f"{API}/bookings/AAAAAAAA01", headers=hdrs).json()
    assert body["patientName"] == "Ayesha Khan" and body["patientNameMasked"] == "Ayesha K."
    assert body["phoneMasked"] == "0300****567" and body["emailMasked"] == "a****@e****.com"
    assert "+923001234567" not in str(body) and "ayesha@example.com" not in str(body)
    assert body["allowedNext"] == ["arrived", "cancelled"]
    assert body["history"][0]["actor"] == "Online booking" and body["version"] == 1
    assert cc_client.get(f"{API}/bookings/ZZZZZZZZZZ", headers=hdrs).status_code == 404


def test_search_results_never_carry_a_full_phone_or_email(
    cc_client: TestClient, db_session: Session, staff_headers: tuple[dict[str, str], Any]
) -> None:
    seed(db_session, "AAAAAAAA01")
    text_ = search(cc_client, staff_headers[0]).text
    assert "+923001234567" not in text_ and "ayesha@example.com" not in text_
    assert "Ayesha K." in text_ and "Ayesha Khan" not in text_


def test_the_demo_gets_sample_pediatrics_detail_with_age_and_booked_by(
    cc_client: TestClient, db_session: Session, demo_headers: dict[str, str]
) -> None:
    dataset = get_dataset(FROZEN_NOW.date())
    child = next(b for b in dataset.bookings if b.booked_by is not None)
    body = cc_client.get(f"{API}/bookings/{child.reference}", headers=demo_headers).json()
    assert body["patientAge"] == child.patient_age and body["bookedBy"] == child.booked_by
    assert body["isSample"] is True


# ----- lookups (T089) -------------------------------------------------------------------------


def test_lookups_list_doctors_and_departments_including_inactive_ones(
    cc_client: TestClient, db_session: Session, staff_headers: tuple[dict[str, str], Any]
) -> None:
    gone = doctor(db_session, "dr-sana-farooqui")
    gone.is_active = False
    db_session.commit()
    body = cc_client.get(f"{API}/lookups", headers=staff_headers[0]).json()
    flagged = {d["name"]: d.get("isActive") for d in body["doctors"]}
    assert flagged[gone.full_name] is False
    assert any(flag is True for flag in flagged.values())
    assert body["departments"] and all("name" in d for d in body["departments"])


def test_the_demo_gets_the_sample_catalog_as_lookups(
    cc_client: TestClient, demo_headers: dict[str, str]
) -> None:
    body = cc_client.get(f"{API}/lookups", headers=demo_headers).json()
    names = {d.name for d in get_dataset(FROZEN_NOW.date()).doctors}
    assert {d["name"] for d in body["doctors"]} == names


def test_a_demo_search_returns_only_sample_bookings_and_never_a_real_one(
    cc_client: TestClient, db_session: Session, demo_headers: dict[str, str]
) -> None:
    seed(db_session, "ABCDEFGHJK", name="Real Patient")
    page = search(cc_client, demo_headers).json()
    assert page["total"] > 0
    assert all(b["reference"].startswith("D") and b["isSample"] for b in page["items"])
    assert "Real" not in str(page)
    assert cc_client.get(f"{API}/bookings/ABCDEFGHJK", headers=demo_headers).status_code == 404


def test_staff_never_see_a_demo_booking(
    cc_client: TestClient, staff_headers: tuple[dict[str, str], Any]
) -> None:
    sample = get_dataset(FROZEN_NOW.date()).bookings[0].reference
    assert cc_client.get(f"{API}/bookings/{sample}", headers=staff_headers[0]).status_code == 404
    assert search(cc_client, staff_headers[0], q="D").json()["items"] == []


# ----- status changes (T086) ------------------------------------------------------------------


def test_a_change_writes_history_and_audit_and_bumps_the_version(
    cc_client: TestClient, db_session: Session, staff_headers: tuple[dict[str, str], Any]
) -> None:
    hdrs, staff = staff_headers
    seed(db_session, "AAAAAAAA01", SOON)
    response = change(cc_client, hdrs, "AAAAAAAA01", "arrived", 1)
    assert response.status_code == 200
    body = response.json()
    assert body["booking"]["status"] == "arrived" and body["booking"]["version"] == 2
    assert body["booking"]["allowedNext"] == ["completed"]  # No-show opens at the start
    assert body["booking"]["history"][-1]["actor"] == "Desk Person"
    assert body["undoExpiresAt"] == "2026-10-05T04:00:10Z"
    (row,) = audit_rows(db_session, "booking.status_changed")
    assert (row.target_reference, row.from_status, row.to_status) == (
        "AAAAAAAA01",
        "confirmed",
        "arrived",
    )
    assert row.actor_staff_id == staff.id
    assert "Ayesha" not in str(row.__dict__) and "+9230" not in str(row.__dict__)


def test_a_change_the_rules_do_not_allow_is_refused(
    cc_client: TestClient, db_session: Session, staff_headers: tuple[dict[str, str], Any]
) -> None:
    hdrs, _ = staff_headers
    seed(db_session, "AAAAAAAA01", NOON)  # three hours away: Arrived is not open yet
    assert (
        error_code(change(cc_client, hdrs, "AAAAAAAA01", "arrived", 1)) == "transition_not_allowed"
    )
    assert error_code(change(cc_client, hdrs, "AAAAAAAA01", "completed", 1)) == (
        "transition_not_allowed"
    )
    assert change(cc_client, hdrs, "AAAAAAAA01", "cancelled", 1).status_code == 200


def test_a_stale_version_is_refused_with_the_current_booking(
    cc_client: TestClient, db_session: Session, staff_headers: tuple[dict[str, str], Any]
) -> None:
    hdrs, _ = staff_headers
    seed(db_session, "AAAAAAAA01", SOON)
    assert change(cc_client, hdrs, "AAAAAAAA01", "arrived", 1).status_code == 200
    stale = change(cc_client, hdrs, "AAAAAAAA01", "no_show", 1)
    assert stale.status_code == 409 and error_code(stale) == "booking_changed"
    assert stale.json()["latest"]["status"] == "arrived"


def test_a_demo_session_cannot_change_anything(
    cc_client: TestClient, demo_headers: dict[str, str]
) -> None:
    ref = get_dataset(FROZEN_NOW.date()).bookings[0].reference
    refused = change(cc_client, demo_headers, ref, "arrived", 1)
    assert refused.status_code == 403 and error_code(refused) == "demo_read_only"
    undo = cc_client.post(
        f"{API}/bookings/{ref}/status/undo",
        json={"changeId": str(uuid.uuid4())},
        headers=demo_headers,
    )
    assert error_code(undo) == "demo_read_only"


def test_cancel_frees_the_slot_for_public_booking(
    cc_client: TestClient,
    db_session: Session,
    staff_headers: tuple[dict[str, str], Any],
    cc_clock: FrozenClock,
) -> None:
    hdrs, _ = staff_headers
    slots = cc_client.get("/api/v1/doctors/dr-omar-sheikh/slots").json()["days"]
    day = next(d for d in slots if d["status"] == "available")
    slot = day["slots"][0]
    start = datetime.fromisoformat(slot["startsAt"].replace("Z", "+00:00"))
    seed(db_session, "AAAAAAAA01", start)
    days = cc_client.get("/api/v1/doctors/dr-omar-sheikh/slots").json()["days"]
    assert slot["startsAt"] not in [s["startsAt"] for d in days for s in d["slots"]]
    assert change(cc_client, hdrs, "AAAAAAAA01", "cancelled", 1).status_code == 200
    days = cc_client.get("/api/v1/doctors/dr-omar-sheikh/slots").json()["days"]
    assert slot["startsAt"] in [s["startsAt"] for d in days for s in d["slots"]]


# ----- undo (T086) ----------------------------------------------------------------------------


def test_undo_restores_the_status_writes_an_undo_row_and_an_audit_entry(
    cc_client: TestClient, db_session: Session, staff_headers: tuple[dict[str, str], Any]
) -> None:
    hdrs, _ = staff_headers
    seed(db_session, "AAAAAAAA01", SOON)
    changed = change(cc_client, hdrs, "AAAAAAAA01", "arrived", 1).json()
    undone = cc_client.post(
        f"{API}/bookings/AAAAAAAA01/status/undo",
        json={"changeId": changed["changeId"]},
        headers=hdrs,
    )
    assert undone.status_code == 200
    body = undone.json()
    assert body["status"] == "confirmed" and body["version"] == 3
    assert body["history"][-1]["isUndo"] is True
    rows = db_session.exec(select(m.AppointmentStatusChange)).all()
    assert [(r.is_undo, r.to_status) for r in rows if r.appointment_id] == [
        (False, "arrived"),
        (True, "confirmed"),
    ]
    assert len(audit_rows(db_session, "booking.status_undone")) == 1
    again = cc_client.post(
        f"{API}/bookings/AAAAAAAA01/status/undo",
        json={"changeId": changed["changeId"]},
        headers=hdrs,
    )
    assert error_code(again) == "undo_unavailable"


def test_undo_is_only_for_the_latest_change_the_same_person_and_ten_seconds(
    cc_client: TestClient,
    db_session: Session,
    cc_settings: Settings,
    cc_clock: FrozenClock,
    staff_headers: tuple[dict[str, str], Any],
) -> None:
    hdrs, _ = staff_headers
    seed(db_session, "AAAAAAAA01", SOON)

    def undo(changed: dict[str, Any], who: dict[str, str]) -> Any:
        return cc_client.post(
            f"{API}/bookings/AAAAAAAA01/status/undo",
            json={"changeId": changed["changeId"]},
            headers=who,
        )

    first = change(cc_client, hdrs, "AAAAAAAA01", "arrived", 1).json()
    second = change(cc_client, hdrs, "AAAAAAAA01", "completed", 2).json()
    assert error_code(undo(first, hdrs)) == "undo_unavailable"  # not the latest

    colleague = make_staff(db_session, "other@example.org", "receptionist", "Other Person")
    theirs, _, _ = staff_session(db_session, cc_settings, colleague, cc_clock.now())
    db_session.commit()
    assert error_code(undo(second, theirs)) == "undo_unavailable"  # not their change

    cc_clock.set(FROZEN_NOW + timedelta(seconds=13))  # ten seconds plus two of grace has passed
    assert error_code(undo(second, hdrs)) == "undo_unavailable"
    cc_clock.set(FROZEN_NOW + timedelta(seconds=11))  # inside the grace
    assert undo(second, hdrs).status_code == 200


def test_undoing_a_cancel_after_the_slot_was_rebooked_is_slot_taken(
    cc_client: TestClient, db_session: Session, staff_headers: tuple[dict[str, str], Any]
) -> None:
    hdrs, _ = staff_headers
    seed(db_session, "AAAAAAAA01", NOON)
    changed = change(cc_client, hdrs, "AAAAAAAA01", "cancelled", 1).json()
    seed(db_session, "AAAAAAAA02", NOON, name="New Person")  # the freed slot is booked again
    refused = cc_client.post(
        f"{API}/bookings/AAAAAAAA01/status/undo",
        json={"changeId": changed["changeId"]},
        headers=hdrs,
    )
    assert refused.status_code == 409 and error_code(refused) == "slot_taken"
    assert refused.json()["latest"]["status"] == "cancelled"


# ----- phone reveal (T088) --------------------------------------------------------------------


def test_a_staff_reveal_returns_the_phone_and_audits_the_reference_only(
    cc_client: TestClient, db_session: Session, staff_headers: tuple[dict[str, str], Any]
) -> None:
    hdrs, _ = staff_headers
    seed(db_session, "AAAAAAAA01")
    response = cc_client.post(f"{API}/bookings/AAAAAAAA01/reveal-phone", headers=hdrs)
    assert response.json() == {
        "phone": "0300 1234567",
        "telHref": "tel:+923001234567",
        "maskAfterSeconds": 60,
    }
    (row,) = audit_rows(db_session, "booking.phone_revealed")
    assert row.target_reference == "AAAAAAAA01"
    assert "1234567" not in str(row.__dict__)
    assert (
        cc_client.post(f"{API}/bookings/ZZZZZZZZZZ/reveal-phone", headers=hdrs).status_code == 404
    )


def test_a_demo_reveal_returns_a_sample_number_and_writes_nothing(
    cc_client: TestClient, db_session: Session, demo_headers: dict[str, str]
) -> None:
    ref = get_dataset(FROZEN_NOW.date()).bookings[0].reference
    response = cc_client.post(f"{API}/bookings/{ref}/reveal-phone", headers=demo_headers)
    assert response.status_code == 200
    assert response.json()["telHref"].startswith("tel:+923")
    assert audit_rows(db_session, "booking.phone_revealed") == []


# ----- transactions and races on a committing engine (T086) -----------------------------------


@pytest.fixture
def committed(
    committing_engine: Engine, cc_settings: Settings, committing_cleanup: None
) -> Iterator[Callable[..., tuple[dict[str, str], m.StaffAccount]]]:
    """Seed one booking and return a factory for signed-in staff, all really committed."""
    with Session(committing_engine) as db:
        seed(db, "AAAAAAAA01", SOON)

    created: list[uuid.UUID] = []

    def make(email: str = "race@example.org") -> tuple[dict[str, str], m.StaffAccount]:
        with Session(committing_engine) as db:
            staff = make_staff(db, email, "receptionist", email.split("@")[0].title())
            hdrs, _, _ = staff_session(db, cc_settings, staff, FROZEN_NOW)
            db.commit()
            db.refresh(staff)
            created.append(staff.id)  # type: ignore[arg-type]
            return hdrs, staff

    yield make
    with committing_engine.begin() as conn:
        conn.execute(text("DELETE FROM audit_log"))
        conn.execute(text("DELETE FROM staff_session"))
        conn.execute(text("DELETE FROM appointment_status_change"))
        conn.execute(text("DELETE FROM staff_account WHERE id = ANY(:ids)"), {"ids": created})


def test_a_fault_before_the_audit_row_saves_nothing(
    make_committing_client: Callable[..., TestClient],
    committing_engine: Engine,
    committed: Callable[..., tuple[dict[str, str], m.StaffAccount]],
    frozen_clock: FrozenClock,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    client = make_committing_client(clock=frozen_clock)
    hdrs, _ = committed()

    def boom(*_: Any, **__: Any) -> None:
        raise RuntimeError("injected fault")

    monkeypatch.setattr("app.command_centre.service.audit.record", boom)
    assert change(client, hdrs, "AAAAAAAA01", "arrived", 1).status_code == 500
    with Session(committing_engine) as db:
        row = db.exec(select(m.Appointment)).one()
        assert (row.status, row.version) == ("confirmed", 1)
        assert db.exec(select(m.AppointmentStatusChange)).all() == []
        assert (
            db.exec(
                select(m.AuditLog).where(col(m.AuditLog.action) == "booking.status_changed")
            ).all()
            == []
        )


def test_two_simultaneous_changes_give_one_success_and_one_booking_changed(
    make_committing_client: Callable[..., TestClient],
    committed: Callable[..., tuple[dict[str, str], m.StaffAccount]],
    frozen_clock: FrozenClock,
) -> None:
    client = make_committing_client(clock=frozen_clock)
    people = [committed("first@example.org")[0], committed("second@example.org")[0]]
    barrier = threading.Barrier(2)

    def attempt(index: int) -> Any:
        barrier.wait()
        return change(client, people[index], "AAAAAAAA01", "arrived", 1)

    with ThreadPoolExecutor(2) as pool:
        results = list(pool.map(attempt, range(2)))
    assert Counter(r.status_code for r in results) == {200: 1, 409: 1}
    loser = next(r for r in results if r.status_code == 409)
    assert error_code(loser) == "booking_changed"
    assert loser.json()["latest"]["status"] == "arrived"
