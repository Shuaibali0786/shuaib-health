"""Department queries (active rows only)."""

from typing import Any

from sqlalchemy import ScalarSelect, func
from sqlalchemy.dialects.postgresql import aggregate_order_by
from sqlmodel import Session, col, select

from app import models as m
from app.repositories._common import paginate

DepartmentRow = tuple[m.Department, list[str]]


def _related_test_slugs() -> ScalarSelect[Any]:
    """Slugs of the department's active related lab tests, in link order."""
    link = m.DepartmentRelatedTest
    return (
        select(func.array_agg(aggregate_order_by(col(m.LabTest.slug), col(link.sort_order))))
        .select_from(link)
        .join(m.LabTest, col(m.LabTest.id) == col(link.lab_test_id))
        .where(col(link.department_id) == col(m.Department.id), col(m.LabTest.is_active))
        .correlate(m.Department)
        .scalar_subquery()
    )


def list_departments(
    session: Session, page: int, page_size: int
) -> tuple[list[DepartmentRow], int]:
    stmt = (
        select(m.Department, _related_test_slugs().label("related_test_slugs"))
        .where(col(m.Department.is_active))
        .order_by(col(m.Department.sort_order), col(m.Department.name), col(m.Department.id))
    )
    rows, total = paginate(session, stmt, page, page_size)
    return [(row[0], row[1] or []) for row in rows], total


def get_department(session: Session, slug: str) -> DepartmentRow | None:
    stmt = select(m.Department, _related_test_slugs().label("related_test_slugs")).where(
        col(m.Department.slug) == slug, col(m.Department.is_active)
    )
    row = session.exec(stmt).first()
    return None if row is None else (row[0], row[1] or [])
