"""``GET /admin/overview`` (US3): the real and the demo answers, the contract shape, the empty and
holiday days, the masked ``recentBookings`` and the Karachi date of a late-evening booking (SC-009).
Time is the frozen 005 clock: Monday 2026-10-05 09:00 in Karachi. The seeded catalogue works on
Mondays as: Mirza 09-13, Qureshi 16-20, Farooqui 10-14, Baloch 12-17, Memon 09-12 (80 slots of 15
minutes), so utilisation is easy to check by hand.
"""

from datetime import UTC, date, datetime, timedelta
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session

from app import models as m
from app.auth import sessions
from app.settings import Settings
from tests.api.admin_support import (
    API,
    FP,
    csrf_for,
    headers,
    make_staff,
    staff_session,
)
from tests.api.test_bookings_admin import doctor, seed
from tests.conftest import FROZEN_NOW, FrozenClock

pytestmark = pytest.mark.db

MIRZA = "dr-hassan-mirza"
QURESHI = "dr-imran-qureshi"
LAST_MONDAY = datetime(2026, 9, 28, 4, 0, tzinfo=UTC)  # 09:00 in Karachi, a week before "now"


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


def get_overview(client: TestClient, hdrs: dict[str, str]) -> Any:
    answer = client.get(f"{API}/overview", headers=hdrs)
    assert answer.status_code == 200, answer.text
    assert answer.headers["cache-control"] == "no-store"
    return answer.json()


def seed_today(db: Session) -> None:
    seed(db, "AAAAAAAA01", FROZEN_NOW, slug=MIRZA, status="arrived")
    seed(db, "AAAAAAAA02", FROZEN_NOW + timedelta(minutes=15), slug=MIRZA)
    seed(db, "AAAAAAAA03", FROZEN_NOW + timedelta(hours=7), slug=QURESHI)
    seed(
        db,
        "AAAAAAAA04",
        FROZEN_NOW + timedelta(hours=7, minutes=15),
        slug=QURESHI,
        status="cancelled",
    )
    seed(db, "AAAAAAAA05", LAST_MONDAY, slug=MIRZA, status="completed")
    seed(db, "AAAAAAAA06", LAST_MONDAY + timedelta(minutes=15), slug=MIRZA, status="no_show")


# ----- the real answer ------------------------------------------------------------------------


def test_kpis_trends_agenda_and_next_up(
    cc_client: TestClient, db_session: Session, staff_headers: dict[str, str]
) -> None:
    seed_today(db_session)
    body = get_overview(cc_client, staff_headers)

    assert body["localDate"] == "2026-10-05"
    assert body["isSample"] is False
    assert body["now"].startswith("2026-10-05T04:00:00")
    assert body["clinicClosed"] is None

    kpis = body["kpis"]
    assert kpis["appointments"] == {
        "value": 3,
        "previous": 2,
        "delta": 1,
        "comparedTo": "2026-09-28",
    }
    assert kpis["arrived"]["value"] == 1 and kpis["arrived"]["previous"] == 1
    assert kpis["completed"]["value"] == 0 and kpis["completed"]["previous"] == 1
    assert kpis["noShows"]["value"] == 0 and kpis["noShows"]["previous"] == 1
    assert kpis["cancellations"]["value"] == 1 and kpis["cancellations"]["previous"] == 0
    # 3 booked of 80 scheduled slots = 3.75 % -> 4 %; last Monday 2 of 80 = 2.5 % -> 3 %.
    assert kpis["utilisationPct"]["value"] == 4 and kpis["utilisationPct"]["previous"] == 3
    assert kpis["utilisationPct"]["delta"] == 1

    # Every doctor working today is a row, booked or not, by the start of the first session.
    assert [row["doctor"]["name"] for row in body["agenda"]] == [
        "Dr. Hassan Mirza",
        "Dr. Zainab Memon",
        "Dr. Sana Farooqui",
        "Dr. Maryam Baloch",
        "Dr. Imran Qureshi",
    ]
    agenda = {row["doctor"]["name"]: row for row in body["agenda"]}
    assert agenda["Dr. Zainab Memon"]["items"] == []
    mirza = agenda["Dr. Hassan Mirza"]
    assert mirza["sessions"] == [{"start": "09:00", "end": "13:00"}]
    assert [b["reference"] for b in mirza["items"]] == ["AAAAAAAA01", "AAAAAAAA02"]

    # Confirmed only, soonest first: the arrived and cancelled ones are not waiting.
    assert [b["reference"] for b in body["nextUp"]] == ["AAAAAAAA02", "AAAAAAAA03"]
    assert body["nextUp"][0]["allowedNext"] == ["arrived", "cancelled"]  # not started yet


def test_next_up_is_limited_to_five(
    cc_client: TestClient, db_session: Session, staff_headers: dict[str, str]
) -> None:
    for i in range(7):
        seed(db_session, f"AAAAAAA{i:03d}", FROZEN_NOW + timedelta(minutes=15 * i), slug=MIRZA)
    body = get_overview(cc_client, staff_headers)
    assert [b["reference"] for b in body["nextUp"]] == [f"AAAAAAA{i:03d}" for i in range(5)]


def test_a_day_without_bookings_is_the_empty_state(
    cc_client: TestClient, staff_headers: dict[str, str]
) -> None:
    body = get_overview(cc_client, staff_headers)
    assert body["agenda"] == [] and body["nextUp"] == []
    assert body["kpis"]["appointments"]["value"] == 0
    assert body["kpis"]["utilisationPct"]["value"] == 0  # 0 of 80 slots, not a dash
    assert body["recentBookings"] == []


def test_a_clinic_holiday_closes_the_day(
    cc_client: TestClient, db_session: Session, staff_headers: dict[str, str]
) -> None:
    db_session.add(m.ClinicHoliday(holiday_date=date(2026, 10, 5), name="Founders Day"))
    db_session.flush()
    body = get_overview(cc_client, staff_headers)
    assert body["clinicClosed"] == "Founders Day"
    assert body["kpis"]["utilisationPct"]["value"] is None  # no scheduled slots: a dash
    assert body["kpis"]["utilisationPct"]["delta"] is None


def test_doctor_leave_removes_slots_from_utilisation(
    cc_client: TestClient, db_session: Session, staff_headers: dict[str, str]
) -> None:
    seed(db_session, "AAAAAAAA01", FROZEN_NOW, slug=MIRZA)
    mirza = doctor(db_session, MIRZA)
    db_session.add(
        m.DoctorLeave(
            doctor_id=mirza.id,  # type: ignore[arg-type]
            starts_at=FROZEN_NOW - timedelta(hours=1),
            ends_at=FROZEN_NOW + timedelta(hours=12),
        )
    )
    db_session.flush()
    body = get_overview(cc_client, staff_headers)
    # Mirza's 16 slots are gone: 1 booked of 64 = 1.56 % -> 2 %.
    assert body["kpis"]["utilisationPct"]["value"] == 2


def test_a_late_evening_booking_counts_on_its_karachi_date(
    cc_client: TestClient, db_session: Session, staff_headers: dict[str, str]
) -> None:
    seed(db_session, "AAAAAAAA01", datetime(2026, 10, 5, 18, 45, tzinfo=UTC), slug=QURESHI)  # 23:45
    seed(
        db_session, "AAAAAAAA02", datetime(2026, 10, 5, 19, 5, tzinfo=UTC), slug=QURESHI
    )  # 00:05 +1
    body = get_overview(cc_client, staff_headers)
    assert body["kpis"]["appointments"]["value"] == 1
    qureshi = next(r for r in body["agenda"] if r["doctor"]["name"] == "Dr. Imran Qureshi")
    assert [b["reference"] for b in qureshi["items"]] == ["AAAAAAAA01"]


# ----- recentBookings (FR-042) ----------------------------------------------------------------


def test_recent_bookings_are_the_five_newest_masked_with_booked_at(
    cc_client: TestClient, db_session: Session, staff_headers: dict[str, str]
) -> None:
    for i in range(6):
        row = seed(
            db_session,
            f"AAAAAAAA{i:02d}",
            FROZEN_NOW + timedelta(days=2, minutes=15 * i),  # appointment dates are irrelevant
            slug=MIRZA,
            name="Ayesha Khan",
            commit=False,
        )
        row.created_at = FROZEN_NOW - timedelta(minutes=10 - i)
    db_session.commit()
    body = get_overview(cc_client, staff_headers)
    recent = body["recentBookings"]
    assert [b["reference"] for b in recent] == [f"AAAAAAAA{i:02d}" for i in (5, 4, 3, 2, 1)]
    assert recent[0]["bookedAt"].startswith("2026-10-05T03:55:00")
    assert recent[0]["patientNameMasked"] == "Ayesha K."
    assert recent[0]["phoneMasked"] == "0300****567"
    assert "Khan" not in cc_client.get(f"{API}/overview", headers=staff_headers).text


# ----- the demo answer ------------------------------------------------------------------------


def test_the_demo_overview_is_sample_data_with_no_recent_bookings(
    cc_client: TestClient, db_session: Session, demo_headers: dict[str, str]
) -> None:
    seed(db_session, "AAAAAAAA01", FROZEN_NOW, slug=MIRZA)  # a real booking the demo must not show
    body = get_overview(cc_client, demo_headers)
    assert body["isSample"] is True
    assert body["recentBookings"] == []
    assert body["agenda"] and body["nextUp"]
    references = [b["reference"] for row in body["agenda"] for b in row["items"]]
    assert references and all(r.startswith("D") for r in references)
    assert body["kpis"]["appointments"]["value"] == len(references) - sum(
        1 for row in body["agenda"] for b in row["items"] if b["status"] == "cancelled"
    )
    assert body["kpis"]["utilisationPct"]["value"] is not None
    assert all(len(row["items"]) <= 40 for row in body["agenda"])


def test_receptionists_and_the_demo_may_read_but_nobody_unsigned(
    cc_client: TestClient, staff_headers: dict[str, str]
) -> None:
    assert cc_client.get(f"{API}/overview", headers=staff_headers).status_code == 200
    unsigned = cc_client.get(f"{API}/overview", headers=headers())
    assert unsigned.status_code == 401
