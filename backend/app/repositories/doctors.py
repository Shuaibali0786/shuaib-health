"""Doctor queries. A doctor is public only if the doctor and their department are active."""

from typing import Any

from sqlalchemy import ColumnClause, ScalarSelect, func, literal_column
from sqlmodel import Session, col, exists, select
from sqlmodel.sql.expression import Select

from app import models as m
from app.repositories._common import LIKE_ESCAPE, WEEKDAY_ORDER, escape_like, paginate

# One weekly session as stored: {"weekday", "start", "end", "slotMinutes"} (times as "HH:MM").
SessionDict = dict[str, Any]
DoctorRow = tuple[m.Doctor, list[SessionDict]]


def _sessions() -> ScalarSelect[Any]:
    """The doctor's weekly sessions as a JSON array (NULL when there are none)."""
    s = m.DoctorWeeklySchedule
    hhmm: ColumnClause[str] = literal_column("'HH24:MI'")
    return (
        select(
            func.json_agg(
                func.json_build_object(
                    literal_column("'weekday'"),
                    col(s.weekday),
                    literal_column("'start'"),
                    func.to_char(col(s.start_time), hhmm),
                    literal_column("'end'"),
                    func.to_char(col(s.end_time), hhmm),
                    literal_column("'slotMinutes'"),
                    col(s.slot_minutes),
                )
            )
        )
        .where(col(s.doctor_id) == col(m.Doctor.id))
        .correlate(m.Doctor)
        .scalar_subquery()
    )


def _public_doctors() -> Select[Any]:
    return (
        select(m.Doctor, _sessions().label("sessions"))
        .join(m.Department, col(m.Department.id) == col(m.Doctor.department_id))
        .where(col(m.Doctor.is_active), col(m.Department.is_active))
    )


def _ordered(sessions: list[SessionDict] | None) -> list[SessionDict]:
    """Monday to Sunday, then by start time."""
    return sorted(sessions or [], key=lambda s: (WEEKDAY_ORDER[s["weekday"]], s["start"]))


def list_doctors(
    session: Session,
    page: int,
    page_size: int,
    department: str | None,
    q: str | None,
    day: str | None,
) -> tuple[list[DoctorRow], int]:
    stmt = _public_doctors()
    if department is not None:
        stmt = stmt.where(col(m.Department.slug) == department)
    if q is not None:
        stmt = stmt.where(col(m.Doctor.full_name).ilike(escape_like(q), escape=LIKE_ESCAPE))
    if day is not None:
        on_that_day = (
            select(col(m.DoctorWeeklySchedule.id))
            .where(
                col(m.DoctorWeeklySchedule.doctor_id) == col(m.Doctor.id),
                col(m.DoctorWeeklySchedule.weekday) == day,
            )
            .correlate(m.Doctor)
        )
        stmt = stmt.where(exists(on_that_day))
    stmt = stmt.order_by(col(m.Doctor.sort_order), col(m.Doctor.full_name), col(m.Doctor.id))
    rows, total = paginate(session, stmt, page, page_size)
    return [(row[0], _ordered(row[1])) for row in rows], total


def get_doctor(session: Session, slug: str) -> DoctorRow | None:
    row = session.exec(_public_doctors().where(col(m.Doctor.slug) == slug)).first()
    return None if row is None else (row[0], _ordered(row[1]))
