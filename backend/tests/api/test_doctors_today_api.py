"""``GET /admin/doctors-today`` (US7). Time is the frozen 005 clock: Monday 2026-10-05 09:00 in
Karachi. The seeded catalogue works on Mondays as: Mirza 09-13 (16 slots), Qureshi 16-20 (16),
Farooqui 10-14 (16), Baloch 12-17 (20), Memon 09-12 (12); the other doctors are not in on Mondays.
"""

from datetime import date, timedelta
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session

from app import models as m
from app.auth import sessions
from app.settings import Settings
from tests.api.admin_support import API, FP, csrf_for, headers, make_staff, staff_session
from tests.api.test_bookings_admin import doctor, seed
from tests.conftest import FROZEN_NOW, FrozenClock

pytestmark = pytest.mark.db

MIRZA = "dr-hassan-mirza"
MEMON = "dr-zainab-memon"


@pytest.fixture
def staff_headers(
    db_session: Session, cc_settings: Settings, cc_clock: FrozenClock
) -> dict[str, str]:
    staff = make_staff(db_session, "desk@example.org", "receptionist", "Desk Person")
    hdrs, _, _ = staff_session(db_session, cc_settings, staff, cc_clock.now())
    db_session.commit()
    return hdrs


@pytest.fixture
def demo_headers(
    db_session: Session, cc_settings: Settings, cc_clock: FrozenClock
) -> dict[str, str]:
    token, row = sessions.create_demo_session(
        db_session, cc_settings, cc_clock.now().date(), FP, cc_clock.now()
    )
    db_session.commit()
    return headers(token, csrf_for(cc_settings, row.id))


def get_today(client: TestClient, hdrs: dict[str, str]) -> Any:
    answer = client.get(f"{API}/doctors-today", headers=hdrs)
    assert answer.status_code == 200, answer.text
    assert answer.headers["cache-control"] == "no-store"
    return answer.json()


def by_name(body: Any) -> dict[str, Any]:
    return {w["doctor"]["name"]: w for w in body["working"]}


def test_booked_free_and_utilisation_follow_the_schedule(
    cc_client: TestClient, db_session: Session, staff_headers: dict[str, str]
) -> None:
    seed(db_session, "AAAAAAAA01", FROZEN_NOW, slug=MIRZA, status="arrived")
    seed(db_session, "AAAAAAAA02", FROZEN_NOW + timedelta(minutes=15), slug=MIRZA)
    seed(
        db_session, "AAAAAAAA03", FROZEN_NOW + timedelta(minutes=30), slug=MIRZA, status="cancelled"
    )
    body = get_today(cc_client, staff_headers)
    assert body["localDate"] == "2026-10-05" and body["clinicClosed"] is None
    mirza = by_name(body)["Dr. Hassan Mirza"]
    assert (mirza["scheduled"], mirza["booked"], mirza["free"]) == (16, 2, 14)
    assert mirza["utilisationPct"] == 13  # 2 / 16 = 12.5 rounds up
    assert mirza["sessions"] == [{"start": "09:00", "end": "13:00"}]
    assert mirza["freePassed"] == 0
    assert mirza["nextFree"] == "09:30"  # 09:00 and 09:15 are booked; the cancelled slot is free
    assert set(by_name(body)) == {
        "Dr. Hassan Mirza",
        "Dr. Zainab Memon",
        "Dr. Sana Farooqui",
        "Dr. Maryam Baloch",
        "Dr. Imran Qureshi",
    }


def test_working_doctors_are_ordered_by_their_next_free_slot(
    cc_client: TestClient, staff_headers: dict[str, str]
) -> None:
    names = [w["doctor"]["name"] for w in get_today(cc_client, staff_headers)["working"]]
    # Next free: Mirza and Memon 09:00 (name order), Farooqui 10:00, Baloch 12:00, Qureshi 16:00.
    assert names == [
        "Dr. Hassan Mirza",
        "Dr. Zainab Memon",
        "Dr. Sana Farooqui",
        "Dr. Maryam Baloch",
        "Dr. Imran Qureshi",
    ]


def test_not_in_today_lists_doctors_without_a_monday_session(
    cc_client: TestClient, staff_headers: dict[str, str]
) -> None:
    body = get_today(cc_client, staff_headers)
    assert body["onLeave"] == []
    assert {d["name"] for d in body["notIn"]}.isdisjoint(by_name(body))
    assert len(body["notIn"]) >= 3
    assert [d["name"] for d in body["notIn"]] == sorted(d["name"] for d in body["notIn"])


def test_leave_over_the_working_day_is_on_leave(
    cc_client: TestClient, db_session: Session, staff_headers: dict[str, str]
) -> None:
    memon = doctor(db_session, MEMON)
    db_session.add(
        m.DoctorLeave(
            doctor_id=memon.id,  # type: ignore[arg-type]
            starts_at=FROZEN_NOW - timedelta(hours=2),
            ends_at=FROZEN_NOW + timedelta(hours=12),
            note="private note that must never be shown",
        )
    )
    db_session.flush()
    answer = cc_client.get(f"{API}/doctors-today", headers=staff_headers)
    body = answer.json()
    assert [d["name"] for d in body["onLeave"]] == ["Dr. Zainab Memon"]
    assert "Dr. Zainab Memon" not in by_name(body)
    assert "private note" not in answer.text


def test_a_holiday_closes_the_clinic(
    cc_client: TestClient, db_session: Session, staff_headers: dict[str, str]
) -> None:
    db_session.add(m.ClinicHoliday(holiday_date=date(2026, 10, 5), name="Founders Day"))
    db_session.flush()
    body = get_today(cc_client, staff_headers)
    assert body["clinicClosed"] == "Founders Day"
    assert body["working"] == [] and body["onLeave"] == [] and body["notIn"] == []


def test_the_demo_gets_sample_schedules_and_never_real_bookings(
    cc_client: TestClient, db_session: Session, demo_headers: dict[str, str]
) -> None:
    seed(db_session, "AAAAAAAA01", FROZEN_NOW, slug=MIRZA)
    body = get_today(cc_client, demo_headers)
    assert body["isSample"] is True
    assert body["working"]
    for w in body["working"]:
        assert w["free"] == max(0, w["scheduled"] - w["booked"])
        assert 0 <= w["utilisationPct"] <= 100
    assert get_today(cc_client, demo_headers) == body


def test_nobody_unsigned_may_read(cc_client: TestClient) -> None:
    assert cc_client.get(f"{API}/doctors-today", headers=headers()).status_code == 401
