import uuid
from datetime import UTC, datetime, time, timedelta
from typing import Any

import pytest
from alembic import command
from sqlalchemy import Connection, Engine, inspect, select, text
from sqlalchemy.exc import IntegrityError

from app.booking.timeutil import to_utc
from app.models import Doctor, DoctorWeeklySchedule
from app.seed.loader import run_seed
from tests.conftest import run_alembic

pytestmark = pytest.mark.db

TABLES = {
    "clinic_settings",
    "clinic_rule",
    "department",
    "doctor",
    "doctor_weekly_schedule",
    "lab_test_category",
    "lab_test",
    "health_package",
    "department_related_test",
    "lab_test_related_department",
    "health_package_test",
    "doctor_leave",
    "clinic_holiday",
    "appointment",
    "idempotency_key",
    "rate_limit_counter",
    "audit_log",
}
BOOKING_TABLES = {
    "doctor_leave",
    "clinic_holiday",
    "appointment",
    "idempotency_key",
    "rate_limit_counter",
    "audit_log",
}


def table_names(engine: Engine) -> set[str]:
    with engine.connect() as conn:
        return set(inspect(conn).get_table_names()) - {"alembic_version"}


def test_downgrade_and_upgrade_round_trip(migrated_engine: Engine) -> None:
    try:
        for _ in range(2):
            run_alembic(migrated_engine, lambda cfg: command.downgrade(cfg, "base"))
            assert table_names(migrated_engine) == set()
            run_alembic(migrated_engine, lambda cfg: command.upgrade(cfg, "head"))
            assert table_names(migrated_engine) == TABLES
    finally:
        # Leave the session database migrated and seeded for any later tests.
        run_alembic(migrated_engine, lambda cfg: command.upgrade(cfg, "head"))
        run_seed(migrated_engine)


def test_models_match_migrations(migrated_engine: Engine) -> None:
    run_alembic(migrated_engine, command.check)


def test_overlapping_sessions_are_rejected(seeded_engine: Engine) -> None:
    with seeded_engine.connect() as conn, conn.begin() as trans:
        doctor_id: uuid.UUID = conn.execute(select(Doctor.__table__.c.id).limit(1)).scalar_one()
        table = DoctorWeeklySchedule.__table__
        conn.execute(
            text("DELETE FROM doctor_weekly_schedule WHERE doctor_id = :id"), {"id": doctor_id}
        )
        conn.execute(
            table.insert(),
            {
                "doctor_id": doctor_id,
                "weekday": "sun",
                "start_time": time(9),
                "end_time": time(12),
                "slot_minutes": 15,
            },
        )
        with (
            pytest.raises(IntegrityError, match="ex_doctor_weekly_schedule_no_overlap"),
            conn.begin_nested(),
        ):
            conn.execute(
                table.insert(),
                {
                    "doctor_id": doctor_id,
                    "weekday": "sun",
                    "start_time": time(11),
                    "end_time": time(13),
                    "slot_minutes": 15,
                },
            )
        trans.rollback()


def test_booking_migration_downgrades_to_the_catalog_and_upgrades_again(
    migrated_engine: Engine,
) -> None:
    try:
        run_alembic(migrated_engine, lambda cfg: command.downgrade(cfg, "0001_catalog"))
        assert not BOOKING_TABLES & table_names(migrated_engine)
        with migrated_engine.connect() as conn:
            columns = {c["name"] for c in inspect(conn).get_columns("clinic_settings")}
        assert "booking_window_days" not in columns
        run_alembic(migrated_engine, lambda cfg: command.upgrade(cfg, "head"))
        assert table_names(migrated_engine) >= BOOKING_TABLES
        run_alembic(migrated_engine, command.check)
    finally:
        run_alembic(migrated_engine, lambda cfg: command.upgrade(cfg, "head"))
        run_seed(migrated_engine)


def test_overlap_constraint_exists(seeded_engine: Engine) -> None:
    with seeded_engine.connect() as conn:
        row = conn.execute(
            text(
                "SELECT contype FROM pg_constraint "
                "WHERE conname = 'ex_appointment_no_overlap' AND conrelid = 'appointment'::regclass"
            )
        ).first()
    assert row is not None
    assert row[0] == "x"


def _insert_appointment(
    conn: Connection,
    doctor_id: uuid.UUID,
    department_id: uuid.UUID,
    starts_at: datetime,
    minutes: int = 15,
    *,
    status: str = "confirmed",
    reference: str | None = None,
) -> None:
    params: dict[str, Any] = {
        "ref": reference or uuid.uuid4().hex[:10].upper().replace("I", "1").replace("O", "0"),
        "doctor": doctor_id,
        "department": department_id,
        "starts": starts_at,
        "ends": starts_at + timedelta(minutes=minutes),
        "status": status,
        "now": datetime(2026, 10, 1, tzinfo=UTC),
    }
    conn.execute(
        text(
            "INSERT INTO appointment (reference, doctor_id, department_id, starts_at, ends_at, "
            "status, fee_pkr, patient_name, patient_phone, rules_accepted_at, rules_version) "
            "VALUES (:ref, :doctor, :department, :starts, :ends, :status, 1000, 'Ali Khan', "
            "'+923001234567', :now, 'abc')"
        ),
        params,
    )


def _doctor_and_department(conn: Connection) -> tuple[uuid.UUID, uuid.UUID]:
    row = conn.execute(text("SELECT id, department_id FROM doctor LIMIT 1")).one()
    return row[0], row[1]


START = datetime(2026, 10, 6, 5, 0, tzinfo=UTC)


def test_overlapping_confirmed_appointments_are_rejected_with_23p01(seeded_engine: Engine) -> None:
    with seeded_engine.connect() as conn, conn.begin() as trans:
        doctor, department = _doctor_and_department(conn)
        _insert_appointment(conn, doctor, department, START, 30)
        with (
            pytest.raises(IntegrityError, match="ex_appointment_no_overlap") as info,
            conn.begin_nested(),
        ):
            _insert_appointment(conn, doctor, department, START + timedelta(minutes=15), 15)
        assert getattr(info.value.orig, "sqlstate", None) == "23P01"
        trans.rollback()


def test_back_to_back_slots_both_insert(seeded_engine: Engine) -> None:
    with seeded_engine.connect() as conn, conn.begin() as trans:
        doctor, department = _doctor_and_department(conn)
        _insert_appointment(conn, doctor, department, START)
        _insert_appointment(conn, doctor, department, START + timedelta(minutes=15))
        trans.rollback()


def test_overlapping_cancelled_appointment_inserts(seeded_engine: Engine) -> None:
    with seeded_engine.connect() as conn, conn.begin() as trans:
        doctor, department = _doctor_and_department(conn)
        _insert_appointment(conn, doctor, department, START)
        _insert_appointment(conn, doctor, department, START, status="cancelled")
        trans.rollback()


def test_other_doctors_can_share_a_time(seeded_engine: Engine) -> None:
    with seeded_engine.connect() as conn, conn.begin() as trans:
        rows = conn.execute(text("SELECT id, department_id FROM doctor LIMIT 2")).all()
        assert len(rows) == 2
        _insert_appointment(conn, rows[0][0], rows[0][1], START)
        _insert_appointment(conn, rows[1][0], rows[1][1], START)
        trans.rollback()


def test_stored_instant_is_independent_of_the_session_time_zone(seeded_engine: Engine) -> None:
    with seeded_engine.connect() as conn, conn.begin() as trans:
        conn.execute(text("SET TIME ZONE 'Asia/Tokyo'"))
        doctor, department = _doctor_and_department(conn)
        _insert_appointment(conn, doctor, department, START)
        stored = conn.execute(
            text("SELECT starts_at FROM appointment WHERE doctor_id = :d"), {"d": doctor}
        ).scalar_one()
        assert to_utc(stored) == START
        assert to_utc(stored).utcoffset() == timedelta(0)
        trans.rollback()
