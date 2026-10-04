"""The ``committing_engine`` fixtures commit for real and clean up after each test (T024)."""

from collections.abc import Callable

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import Engine, text

pytestmark = pytest.mark.db

INSERT_AUDIT = text(
    "INSERT INTO audit_log (actor_fingerprint, action, outcome) "
    "VALUES ('0123456789abcdef', 'appointment.created', 'ok')"
)
COUNT_AUDIT = text("SELECT count(*) FROM audit_log")


def test_rows_written_through_the_committing_engine_are_really_committed(
    committing_engine: Engine, committing_cleanup: None
) -> None:
    with committing_engine.begin() as conn:
        conn.execute(INSERT_AUDIT)
    with committing_engine.connect() as other:
        assert other.execute(COUNT_AUDIT).scalar_one() == 1


def test_the_previous_test_left_nothing_behind(
    committing_engine: Engine, committing_cleanup: None
) -> None:
    with committing_engine.connect() as conn:
        assert conn.execute(COUNT_AUDIT).scalar_one() == 0


def test_the_committing_client_serves_the_seeded_catalog(
    make_committing_client: Callable[..., TestClient],
) -> None:
    client = make_committing_client()
    response = client.get("/api/v1/doctors")
    assert response.status_code == 200
    assert response.json()["items"]


def test_the_committing_pool_is_big_enough_for_a_race(committing_engine: Engine) -> None:
    assert committing_engine.pool.size() == 25  # type: ignore[attr-defined]
