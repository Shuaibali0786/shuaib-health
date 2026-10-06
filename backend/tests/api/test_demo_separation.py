"""Demo and real data never mix (SC-005). Every READ route a demo session can call returns only
sample records with ``D`` references; staff never see a ``D`` reference. Each later story adds its
read routes to ``READ_ROUTES`` (and the booking-detail 404 case) as the routes appear."""

from datetime import timedelta
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, select

from app import models as m
from app.auth import sessions
from app.demo.generator import get_dataset
from app.settings import Settings
from tests.api.admin_support import API, FP, csrf_for, headers, make_staff, staff_session
from tests.conftest import FROZEN_NOW, FrozenClock

pytestmark = pytest.mark.db

REAL_REFERENCE = "ABCDEFGHJK"
# (path, how the demo and staff answers are walked); extended by the US4/US3/US6/US7/US8 stories.
READ_ROUTES = ["/staff"]


def walk(value: Any) -> list[dict[str, Any]]:
    """Every dict in a JSON answer."""
    found: list[dict[str, Any]] = []
    if isinstance(value, dict):
        found.append(value)
        for child in value.values():
            found.extend(walk(child))
    elif isinstance(value, list):
        for child in value:
            found.extend(walk(child))
    return found


@pytest.fixture
def real_booking(db_session: Session) -> m.Appointment:
    doctor = db_session.exec(select(m.Doctor)).first()
    assert doctor is not None
    booking = m.Appointment(
        reference=REAL_REFERENCE,
        doctor_id=doctor.id,  # type: ignore[arg-type]
        department_id=doctor.department_id,
        starts_at=FROZEN_NOW + timedelta(hours=3),
        ends_at=FROZEN_NOW + timedelta(hours=3, minutes=15),
        fee_pkr=doctor.fee_pkr,
        patient_name="Real Patient",
        patient_phone="+923001234567",
        rules_accepted_at=FROZEN_NOW,
        rules_version="0" * 16,
    )
    db_session.add(booking)
    db_session.flush()
    return booking


@pytest.mark.parametrize("path", READ_ROUTES)
def test_demo_reads_return_only_sample_records(
    cc_client: TestClient,
    db_session: Session,
    cc_settings: Settings,
    cc_clock: FrozenClock,
    real_booking: m.Appointment,
    path: str,
) -> None:
    token, row = sessions.create_demo_session(
        db_session, cc_settings, cc_clock.now().date(), FP, cc_clock.now()
    )
    answer = cc_client.get(f"{API}{path}", headers=headers(token, csrf_for(cc_settings, row.id)))
    assert answer.status_code == 200
    records = walk(answer.json())
    assert records
    assert all(r.get("isSample") is True for r in records if "id" in r or "reference" in r)
    assert all(str(r["reference"]).startswith("D") for r in records if "reference" in r)
    assert REAL_REFERENCE not in answer.text


@pytest.mark.parametrize("path", READ_ROUTES)
def test_staff_reads_never_contain_demo_references(
    cc_client: TestClient,
    db_session: Session,
    cc_settings: Settings,
    cc_clock: FrozenClock,
    real_booking: m.Appointment,
    path: str,
) -> None:
    staff = make_staff(db_session)
    hdrs, _, _ = staff_session(db_session, cc_settings, staff, cc_clock.now())
    answer = cc_client.get(f"{API}{path}", headers=hdrs)
    assert answer.status_code == 200
    assert not any(
        str(r["reference"]).startswith("D") and len(str(r["reference"])) == 10
        for r in walk(answer.json())
        if "reference" in r
    )


def test_a_real_reference_is_not_in_any_demo_dataset(real_booking: m.Appointment) -> None:
    dataset = get_dataset(FROZEN_NOW.date())
    assert all(b.reference.startswith("D") for b in dataset.bookings)
    assert REAL_REFERENCE not in {b.reference for b in dataset.bookings}
