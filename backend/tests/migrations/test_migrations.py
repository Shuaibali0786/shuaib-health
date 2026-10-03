import uuid
from datetime import time

import pytest
from alembic import command
from sqlalchemy import Engine, inspect, select, text
from sqlalchemy.exc import IntegrityError

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
