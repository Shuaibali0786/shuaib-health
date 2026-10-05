"""Twenty simultaneous bookings for one slot give exactly one success (FR-030, FR-031).

Every thread has its own client, mobile number and idempotency key, and the requests really commit.
Frozen "now" is Monday 2026-10-05 09:00 Karachi; ``dr-omar-sheikh`` works Tuesday 14:00-17:00.
"""

import threading
import uuid
from collections import Counter
from collections.abc import Callable
from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import Engine, text

from tests.conftest import FrozenClock

pytestmark = pytest.mark.db

SECRET = "test-proxy-secret-0123456789abcdef"
DOCTOR = "dr-omar-sheikh"
SLOT = datetime(2026, 10, 6, 9, 0, tzinfo=UTC)  # Tue 14:00 Karachi
APPOINTMENTS = "/api/v1/appointments"
RACERS = 20

COUNT_CONFIRMED = text(
    "SELECT count(*) FROM appointment a JOIN doctor d ON d.id = a.doctor_id "
    "WHERE d.slug = :slug AND a.starts_at = :starts_at AND a.status = 'confirmed'"
)


def iso(value: datetime) -> str:
    return value.strftime("%Y-%m-%dT%H:%M:%SZ")


def payload(index: int, starts_at: datetime = SLOT) -> dict[str, Any]:
    return {
        "doctorSlug": DOCTOR,
        "startsAt": iso(starts_at),
        "fullName": f"Racer {chr(65 + index)}",
        "mobile": f"0300{1000000 + index}",
        "email": f"racer{index}@example.com",
        "reason": "Checkup",
        "acceptRules": True,
    }


def race(
    make_client: Callable[..., TestClient], clock: FrozenClock, starts_at: datetime = SLOT
) -> list[Any]:
    clients = [make_client(clock=clock, booking_limit_per_ip_per_hour=1000) for _ in range(RACERS)]
    barrier = threading.Barrier(RACERS)

    def attempt(index: int) -> Any:
        headers = {"X-Proxy-Secret": SECRET, "Idempotency-Key": str(uuid.uuid4())}
        barrier.wait(timeout=30)
        return clients[index].post(APPOINTMENTS, json=payload(index, starts_at), headers=headers)

    with ThreadPoolExecutor(RACERS) as pool:
        return list(pool.map(attempt, range(RACERS)))


def confirmed_at(engine: Engine, starts_at: datetime) -> int:
    with engine.connect() as conn:
        return int(
            conn.execute(COUNT_CONFIRMED, {"slug": DOCTOR, "starts_at": starts_at}).scalar_one()
        )


def test_twenty_simultaneous_bookings_give_one_success_and_nineteen_slot_taken(
    make_committing_client: Callable[..., TestClient],
    frozen_clock: FrozenClock,
    committing_engine: Engine,
) -> None:
    responses = race(make_committing_client, frozen_clock)

    assert Counter(r.status_code for r in responses) == {201: 1, 409: RACERS - 1}
    for response in (r for r in responses if r.status_code == 409):
        body = response.json()
        assert body["error"]["code"] == "slot_taken"
        assert body["error"]["message"] == "Sorry, this slot was just taken."
        assert 1 <= len(body["alternatives"]) <= 5
        assert iso(SLOT) not in [a["startsAt"] for a in body["alternatives"]]
    assert confirmed_at(committing_engine, SLOT) == 1


def test_the_loser_can_book_a_suggested_alternative(
    make_committing_client: Callable[..., TestClient], frozen_clock: FrozenClock
) -> None:
    client = make_committing_client(clock=frozen_clock)
    headers = {"X-Proxy-Secret": SECRET}
    first = client.post(
        APPOINTMENTS, json=payload(0), headers={**headers, "Idempotency-Key": str(uuid.uuid4())}
    )
    loser = client.post(
        APPOINTMENTS, json=payload(1), headers={**headers, "Idempotency-Key": str(uuid.uuid4())}
    )
    assert (first.status_code, loser.status_code) == (201, 409)

    alternative = loser.json()["alternatives"][0]["startsAt"]
    retry = client.post(
        APPOINTMENTS,
        json={**payload(1), "startsAt": alternative},
        headers={**headers, "Idempotency-Key": str(uuid.uuid4())},
    )
    assert retry.status_code == 201, retry.text
    assert retry.json()["startsAt"] == alternative


def test_an_overlapping_longer_slot_is_slot_taken(
    make_committing_client: Callable[..., TestClient],
    frozen_clock: FrozenClock,
    committing_engine: Engine,
) -> None:
    client = make_committing_client(clock=frozen_clock)
    headers = {"X-Proxy-Secret": SECRET}
    first = client.post(
        APPOINTMENTS, json=payload(0), headers={**headers, "Idempotency-Key": str(uuid.uuid4())}
    )
    assert first.status_code == 201, first.text

    with committing_engine.begin() as conn:
        conn.execute(
            text(
                "UPDATE doctor_weekly_schedule SET slot_minutes = 30 WHERE doctor_id = "
                "(SELECT id FROM doctor WHERE slug = :slug) "
                "AND weekday = 'tue' AND start_time = '14:00'"
            ),
            {"slug": DOCTOR},
        )
    try:
        overlap = client.post(
            APPOINTMENTS,
            json=payload(1),
            headers={**headers, "Idempotency-Key": str(uuid.uuid4())},
        )
        assert overlap.status_code == 409, overlap.text
        assert overlap.json()["error"]["code"] == "slot_taken"
    finally:
        with committing_engine.begin() as conn:
            conn.execute(
                text(
                    "UPDATE doctor_weekly_schedule SET slot_minutes = 15 WHERE doctor_id = "
                    "(SELECT id FROM doctor WHERE slug = :slug) "
                    "AND weekday = 'tue' AND start_time = '14:00'"
                ),
                {"slug": DOCTOR},
            )


def test_a_stale_read_still_ends_as_slot_taken_through_the_database_constraint(
    make_committing_client: Callable[..., TestClient],
    frozen_clock: FrozenClock,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """The loser read the slot as free before the winner committed; the constraint stops it."""
    from app.booking import slots

    client = make_committing_client(clock=frozen_clock)
    headers = {"X-Proxy-Secret": SECRET}
    first = client.post(
        APPOINTMENTS, json=payload(0), headers={**headers, "Idempotency-Key": str(uuid.uuid4())}
    )
    assert first.status_code == 201, first.text

    real = slots.is_available
    monkeypatch.setattr(slots, "is_available", lambda **kw: real(**{**kw, "bookings": []}))
    loser = client.post(
        APPOINTMENTS, json=payload(1), headers={**headers, "Idempotency-Key": str(uuid.uuid4())}
    )
    assert loser.status_code == 409, loser.text
    body = loser.json()
    assert body["error"]["code"] == "slot_taken"
    assert 1 <= len(body["alternatives"]) <= 5
    assert iso(SLOT) not in [a["startsAt"] for a in body["alternatives"]]
