"""Lab test and category queries (active rows only)."""

import uuid
from collections import defaultdict
from collections.abc import Sequence

from sqlalchemy import or_, text
from sqlmodel import Session, col, select

from app import models as m
from app.repositories._common import LIKE_ESCAPE, escape_like, paginate

_AKA_MATCH = text(
    "EXISTS (SELECT 1 FROM unnest(lab_test.also_known_as) AS aka "
    "WHERE aka ILIKE :aka_pattern ESCAPE '\\')"
)


def list_categories(
    session: Session, page: int, page_size: int
) -> tuple[Sequence[m.LabTestCategory], int]:
    stmt = select(m.LabTestCategory).order_by(
        col(m.LabTestCategory.sort_order), col(m.LabTestCategory.name), col(m.LabTestCategory.id)
    )
    return paginate(session, stmt, page, page_size)


def list_lab_tests(
    session: Session, page: int, page_size: int, q: str | None, category: str | None
) -> tuple[Sequence[m.LabTest], int]:
    stmt = (
        select(m.LabTest)
        .join(m.LabTestCategory, col(m.LabTestCategory.id) == col(m.LabTest.category_id))
        .where(col(m.LabTest.is_active))
    )
    if category is not None:
        stmt = stmt.where(col(m.LabTestCategory.slug) == category)
    if q is not None:
        pattern = escape_like(q)
        stmt = stmt.where(
            or_(
                col(m.LabTest.name).ilike(pattern, escape=LIKE_ESCAPE),
                _AKA_MATCH.bindparams(aka_pattern=pattern),
            )
        )
    stmt = stmt.order_by(
        col(m.LabTestCategory.sort_order),
        col(m.LabTest.sort_order),
        col(m.LabTest.name),
        col(m.LabTest.id),
    )
    return paginate(session, stmt, page, page_size)


def get_lab_test(session: Session, slug: str) -> m.LabTest | None:
    stmt = select(m.LabTest).where(col(m.LabTest.slug) == slug, col(m.LabTest.is_active))
    return session.exec(stmt).first()


def related_department_ids(
    session: Session, test_ids: Sequence[uuid.UUID]
) -> dict[uuid.UUID, list[uuid.UUID]]:
    """Ids of active related departments per lab test, in link order (one query)."""
    link = m.LabTestRelatedDepartment
    stmt = (
        select(col(link.lab_test_id), col(link.department_id))
        .join(m.Department, col(m.Department.id) == col(link.department_id))
        .where(col(link.lab_test_id).in_(test_ids), col(m.Department.is_active))
        .order_by(col(link.lab_test_id), col(link.sort_order))
    )
    result: dict[uuid.UUID, list[uuid.UUID]] = defaultdict(list)
    for test_id, department_id in session.exec(stmt):
        result[test_id].append(department_id)
    return result
