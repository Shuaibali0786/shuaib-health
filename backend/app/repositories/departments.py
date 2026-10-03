"""Department queries (active rows only)."""

import uuid
from collections import defaultdict
from collections.abc import Sequence

from sqlmodel import Session, col, select

from app import models as m
from app.repositories._common import paginate


def list_departments(
    session: Session, page: int, page_size: int
) -> tuple[Sequence[m.Department], int]:
    stmt = (
        select(m.Department)
        .where(col(m.Department.is_active))
        .order_by(col(m.Department.sort_order), col(m.Department.name), col(m.Department.id))
    )
    return paginate(session, stmt, page, page_size)


def get_department(session: Session, slug: str) -> m.Department | None:
    stmt = select(m.Department).where(col(m.Department.slug) == slug, col(m.Department.is_active))
    return session.exec(stmt).first()


def related_test_slugs(
    session: Session, department_ids: Sequence[uuid.UUID]
) -> dict[uuid.UUID, list[str]]:
    """Slugs of active related lab tests per department, in link order (one query)."""
    link = m.DepartmentRelatedTest
    stmt = (
        select(col(link.department_id), col(m.LabTest.slug))
        .select_from(link)
        .join(m.LabTest, col(m.LabTest.id) == col(link.lab_test_id))
        .where(col(link.department_id).in_(department_ids), col(m.LabTest.is_active))
        .order_by(col(link.department_id), col(link.sort_order))
    )
    result: dict[uuid.UUID, list[str]] = defaultdict(list)
    for department_id, slug in session.exec(stmt):
        result[department_id].append(slug)
    return result
