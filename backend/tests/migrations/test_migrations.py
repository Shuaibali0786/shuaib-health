import uuid
from datetime import UTC, datetime, time, timedelta
from typing import Any, cast

import pytest
from alembic import command
from sqlalchemy import Connection, Engine, inspect, select, text
from sqlalchemy.exc import IntegrityError
from sqlmodel import col

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
    "staff_account",
    "staff_session",
    "demo_session",
    "login_throttle",
    "appointment_status_change",
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
        doctor_id: uuid.UUID = conn.execute(select(col(Doctor.id)).limit(1)).scalar_one()  # type: ignore[assignment]
        table = cast(Any, DoctorWeeklySchedule).__table__
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


COMMAND_CENTRE_TABLES = {
    "staff_account",
    "staff_session",
    "demo_session",
    "login_throttle",
    "appointment_status_change",
}


def _constraint_names(engine: Engine, table: str) -> set[str]:
    with engine.connect() as conn:
        rows = conn.execute(
            text("SELECT conname FROM pg_constraint WHERE conrelid = to_regclass(:t)"), {"t": table}
        )
        return {row[0] for row in rows}


def _index_names(engine: Engine, table: str) -> set[str]:
    with engine.connect() as conn:
        return {i["name"] for i in inspect(conn).get_indexes(table) if i["name"]}


def _columns(engine: Engine, table: str) -> set[str]:
    with engine.connect() as conn:
        return {c["name"] for c in inspect(conn).get_columns(table)}


def test_0003_creates_tables_columns_checks_and_indexes(migrated_engine: Engine) -> None:
    assert table_names(migrated_engine) >= COMMAND_CENTRE_TABLES
    assert _columns(migrated_engine, "staff_account") >= {
        "email",
        "display_name",
        "role",
        "is_active",
        "password_hash",
        "must_change_password",
        "password_changed_at",
        "last_sign_in_at",
        "created_by_id",
    }
    assert _columns(migrated_engine, "staff_session") >= {
        "staff_id",
        "token_hash",
        "last_seen_at",
        "idle_expires_at",
        "absolute_expires_at",
        "ended_at",
        "end_reason",
        "ip_fingerprint",
    }
    assert _columns(migrated_engine, "demo_session") >= {"token_hash", "demo_date", "expires_at"}
    assert _columns(migrated_engine, "login_throttle") >= {
        "subject_hash",
        "failed_count",
        "window_started_at",
        "locked_until",
        "expires_at",
    }
    assert "version" in _columns(migrated_engine, "appointment")
    assert _columns(migrated_engine, "audit_log") >= {
        "actor_staff_id",
        "actor_role",
        "target_reference",
        "from_status",
        "to_status",
    }
    assert _constraint_names(migrated_engine, "staff_account") >= {
        "ck_staff_account_role_valid",
        "ck_staff_account_password_hash_argon2id",
        "uq_staff_account_email",
    }
    assert _constraint_names(migrated_engine, "staff_session") >= {
        "ck_staff_session_absolute_after_created",
        "ck_staff_session_end_reason_valid",
        "uq_staff_session_token_hash",
    }
    assert _constraint_names(migrated_engine, "appointment_status_change") >= {
        "ck_appointment_status_change_status_differs",
        "ck_appointment_status_change_undo_consistent",
    }
    assert "ck_appointment_version_positive" in _constraint_names(migrated_engine, "appointment")
    assert _constraint_names(migrated_engine, "audit_log") >= {
        "ck_audit_log_actor_type_valid",
        "ck_audit_log_actor_role_valid",
    }
    assert "ix_staff_session_staff_id_active" in _index_names(migrated_engine, "staff_session")
    assert "ix_appointment_starts_at" in _index_names(migrated_engine, "appointment")
    assert _index_names(migrated_engine, "audit_log") >= {
        "ix_audit_log_actor_staff_id_occurred_at",
        "ix_audit_log_action_occurred_at",
    }
    assert "ix_appointment_status_change_appointment_id_occurred_at" in _index_names(
        migrated_engine, "appointment_status_change"
    )


def test_exclusion_constraint_is_widened_to_every_status_but_cancelled(
    seeded_engine: Engine,
) -> None:
    with seeded_engine.connect() as conn:
        definition = conn.execute(
            text(
                "SELECT pg_get_constraintdef(oid) FROM pg_constraint "
                "WHERE conname = 'ex_appointment_no_overlap'"
            )
        ).scalar_one()
    assert "cancelled" in definition
    assert "confirmed" not in definition


@pytest.mark.parametrize("status", ["arrived", "completed", "no_show"])
def test_non_cancelled_statuses_still_hold_the_slot(seeded_engine: Engine, status: str) -> None:
    with seeded_engine.connect() as conn, conn.begin() as trans:
        doctor, department = _doctor_and_department(conn)
        _insert_appointment(conn, doctor, department, START, status=status)
        with pytest.raises(IntegrityError, match="ex_appointment_no_overlap"), conn.begin_nested():
            _insert_appointment(conn, doctor, department, START)
        trans.rollback()


def test_downgrade_to_0002_restores_the_old_schema_and_upgrades_again(
    migrated_engine: Engine,
) -> None:
    try:
        run_alembic(migrated_engine, lambda cfg: command.downgrade(cfg, "0002_booking"))
        assert not COMMAND_CENTRE_TABLES & table_names(migrated_engine)
        assert "version" not in _columns(migrated_engine, "appointment")
        assert "actor_staff_id" not in _columns(migrated_engine, "audit_log")
        with migrated_engine.connect() as conn:
            definition = conn.execute(
                text(
                    "SELECT pg_get_constraintdef(oid) FROM pg_constraint "
                    "WHERE conname = 'ex_appointment_no_overlap'"
                )
            ).scalar_one()
        assert "confirmed" in definition
        run_alembic(migrated_engine, lambda cfg: command.upgrade(cfg, "head"))
        run_alembic(migrated_engine, command.check)
    finally:
        run_alembic(migrated_engine, lambda cfg: command.upgrade(cfg, "head"))
        run_seed(migrated_engine)


@pytest.mark.parametrize("status", ["arrived", "no_show"])
def test_downgrade_refuses_while_unrepresentable_bookings_exist(
    migrated_engine: Engine, status: str
) -> None:
    run_seed(migrated_engine)
    with migrated_engine.begin() as conn:
        doctor, department = _doctor_and_department(conn)
        _insert_appointment(conn, doctor, department, START, status=status, reference="RFSAB00001")
    try:
        with pytest.raises(RuntimeError, match="0003_command_centre"):
            run_alembic(migrated_engine, lambda cfg: command.downgrade(cfg, "0002_booking"))
        assert table_names(migrated_engine) >= COMMAND_CENTRE_TABLES
    finally:
        with migrated_engine.begin() as conn:
            conn.execute(text("DELETE FROM appointment WHERE reference = 'RFSAB00001'"))
