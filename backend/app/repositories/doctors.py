"""Doctor queries. A doctor is public only if the doctor and their department are active."""

import uuid
from collections import defaultdict
from collections.abc import Sequence

from sqlmodel import Session, col, exists, select
from sqlmodel.sql.expression import SelectOfScalar

from app import models as m
from app.repositories._common import LIKE_ESCAPE, WEEKDAY_ORDER, escape_like, paginate


def _public_doctors() -> SelectOfScalar[m.Doctor]:
    return (
        select(m.Doctor)
        .join(m.Department, col(m.Department.id) == col(m.Doctor.department_id))
        .where(col(m.Doctor.is_active), col(m.Department.is_active))
    )


def list_doctors(
    session: Session,
    page: int,
    page_size: int,
    department: str | None,
    q: str | None,
    day: str | None,
) -> tuple[Sequence[m.Doctor], int]:
    stmt = _public_doctors()
    if department is not None:
        stmt = stmt.where(col(m.Department.slug) == department)
    if q is not None:
        stmt = stmt.where(col(m.Doctor.full_name).ilike(escape_like(q), escape=LIKE_ESCAPE))
    if day is not None:
        sessions = (
            select(col(m.DoctorWeeklySchedule.id))
            .where(
                col(m.DoctorWeeklySchedule.doctor_id) == col(m.Doctor.id),
                col(m.DoctorWeeklySchedule.weekday) == day,
            )
            .correlate(m.Doctor)
        )
        stmt = stmt.where(exists(sessions))
    stmt = stmt.order_by(col(m.Doctor.sort_order), col(m.Doctor.full_name), col(m.Doctor.id))
    return paginate(session, stmt, page, page_size)


def get_doctor(session: Session, slug: str) -> m.Doctor | None:
    return session.exec(_public_doctors().where(col(m.Doctor.slug) == slug)).first()


def schedules_for(
    session: Session, doctor_ids: Sequence[uuid.UUID]
) -> dict[uuid.UUID, list[m.DoctorWeeklySchedule]]:
    """Weekly sessions per doctor, ordered Monday to Sunday then by start time (one query)."""
    stmt = select(m.DoctorWeeklySchedule).where(
        col(m.DoctorWeeklySchedule.doctor_id).in_(doctor_ids)
    )
    result: dict[uuid.UUID, list[m.DoctorWeeklySchedule]] = defaultdict(list)
    for row in session.exec(stmt):
        result[row.doctor_id].append(row)
    for sessions in result.values():
        sessions.sort(key=lambda s: (WEEKDAY_ORDER[s.weekday], s.start_time))
    return result
