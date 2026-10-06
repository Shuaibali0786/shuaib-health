"""SC-002: 100 races of 20 simultaneous bookings, each on an empty slot, never double book."""

from collections import Counter
from collections.abc import Callable

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import Engine, text

from tests.api.test_booking_concurrency import RACERS, SLOT, confirmed_at, race
from tests.conftest import FrozenClock

pytestmark = [pytest.mark.db, pytest.mark.perf]

REPEATS = 100


def test_one_hundred_races_never_double_book(
    make_committing_client: Callable[..., TestClient],
    frozen_clock: FrozenClock,
    committing_engine: Engine,
) -> None:
    anomalies: list[str] = []
    for round_number in range(REPEATS):
        responses = race(make_committing_client, frozen_clock)
        statuses = Counter(r.status_code for r in responses)
        confirmed = confirmed_at(committing_engine, SLOT)
        if statuses != {201: 1, 409: RACERS - 1} or confirmed != 1:
            anomalies.append(f"race {round_number}: {dict(statuses)}, {confirmed} confirmed")
        with committing_engine.begin() as conn:  # an empty slot for the next race
            conn.execute(
                text(
                    "TRUNCATE appointment, appointment_status_change, idempotency_key, rate_limit_counter, audit_log"
                )
            )
    assert not anomalies, anomalies
