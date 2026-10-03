"""Lab test and category queries (active rows only)."""

import uuid
from collections.abc import Sequence
from typing import Any

from sqlalchemy import ScalarSelect, func, or_, text
from sqlalchemy.dialects.postgresql import aggregate_order_by
from sqlmodel import Session, col, select
from sqlmodel.sql.expression import Select

from app import models as m
from app.repositories._common import LIKE_ESCAPE, escape_like, paginate

LabTestRow = tuple[m.LabTest, list[uuid.UUID]]

_AKA_MATCH = text(
    "EXISTS (SELECT 1 FROM unnest(lab_test.also_known_as) AS aka "
    "WHERE aka ILIKE :aka_pattern ESCAPE '\\')"
)


def _related_department_ids() -> ScalarSelect[Any]:
    """Ids of the test's active related departments, in link order."""
    link = m.LabTestRelatedDepartment
    return (
        select(func.array_agg(aggregate_order_by(col(link.department_id), col(link.sort_order))))
        .select_from(link)
        .join(m.Department, col(m.Department.id) == col(link.department_id))
        .where(col(link.lab_test_id) == col(m.LabTest.id), col(m.Department.is_active))
        .correlate(m.LabTest)
        .scalar_subquery()
    )


def _select_tests() -> Select[Any]:
    return (
        select(m.LabTest, _related_department_ids().label("related_department_ids"))
        .join(m.LabTestCategory, col(m.LabTestCategory.id) == col(m.LabTest.category_id))
        .where(col(m.LabTest.is_active))
    )


def list_categories(
    session: Session, page: int, page_size: int
) -> tuple[Sequence[m.LabTestCategory], int]:
    stmt = select(m.LabTestCategory).order_by(
        col(m.LabTestCategory.sort_order), col(m.LabTestCategory.name), col(m.LabTestCategory.id)
    )
    rows, total = paginate(session, stmt, page, page_size)
    return [row[0] for row in rows], total


def list_lab_tests(
    session: Session, page: int, page_size: int, q: str | None, category: str | None
) -> tuple[list[LabTestRow], int]:
    stmt = _select_tests()
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
    rows, total = paginate(session, stmt, page, page_size)
    return [(row[0], row[1] or []) for row in rows], total


def get_lab_test(session: Session, slug: str) -> LabTestRow | None:
    row = session.exec(_select_tests().where(col(m.LabTest.slug) == slug)).first()
    return None if row is None else (row[0], row[1] or [])
