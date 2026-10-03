"""Health package queries (active rows only).

A package carries its included active tests, in package order, as a list of summaries
``{"id", "slug", "name", "pricePkr", "homeCollection"}`` fetched in the same query.
"""

from typing import Any

from sqlalchemy import ScalarSelect, func, literal_column
from sqlalchemy.dialects.postgresql import aggregate_order_by
from sqlmodel import Session, col, select

from app import models as m
from app.repositories._common import paginate

TestSummary = dict[str, Any]
PackageRow = tuple[m.HealthPackage, list[TestSummary]]


def _included_tests() -> ScalarSelect[Any]:
    link = m.HealthPackageTest
    t = m.LabTest
    summary = func.json_build_object(
        literal_column("'id'"),
        col(t.id),
        literal_column("'slug'"),
        col(t.slug),
        literal_column("'name'"),
        col(t.name),
        literal_column("'pricePkr'"),
        col(t.price_pkr),
        literal_column("'homeCollection'"),
        col(t.home_collection),
    )
    return (
        select(func.json_agg(aggregate_order_by(summary, col(link.sort_order))))
        .select_from(link)
        .join(t, col(t.id) == col(link.lab_test_id))
        .where(col(link.package_id) == col(m.HealthPackage.id), col(t.is_active))
        .correlate(m.HealthPackage)
        .scalar_subquery()
    )


def list_packages(session: Session, page: int, page_size: int) -> tuple[list[PackageRow], int]:
    stmt = (
        select(m.HealthPackage, _included_tests().label("tests"))
        .where(col(m.HealthPackage.is_active))
        .order_by(
            col(m.HealthPackage.sort_order), col(m.HealthPackage.name), col(m.HealthPackage.id)
        )
    )
    rows, total = paginate(session, stmt, page, page_size)
    return [(row[0], row[1] or []) for row in rows], total


def get_package(session: Session, slug: str) -> PackageRow | None:
    stmt = select(m.HealthPackage, _included_tests().label("tests")).where(
        col(m.HealthPackage.slug) == slug, col(m.HealthPackage.is_active)
    )
    row = session.exec(stmt).first()
    return None if row is None else (row[0], row[1] or [])
