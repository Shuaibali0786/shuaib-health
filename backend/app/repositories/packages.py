"""Health package queries (active rows only)."""

import uuid
from collections import defaultdict
from collections.abc import Sequence

from sqlmodel import Session, col, select

from app import models as m
from app.repositories._common import paginate


def list_packages(
    session: Session, page: int, page_size: int
) -> tuple[Sequence[m.HealthPackage], int]:
    stmt = (
        select(m.HealthPackage)
        .where(col(m.HealthPackage.is_active))
        .order_by(
            col(m.HealthPackage.sort_order), col(m.HealthPackage.name), col(m.HealthPackage.id)
        )
    )
    return paginate(session, stmt, page, page_size)


def get_package(session: Session, slug: str) -> m.HealthPackage | None:
    stmt = select(m.HealthPackage).where(
        col(m.HealthPackage.slug) == slug, col(m.HealthPackage.is_active)
    )
    return session.exec(stmt).first()


def tests_for(
    session: Session, package_ids: Sequence[uuid.UUID]
) -> dict[uuid.UUID, list[m.LabTest]]:
    """Active lab tests included in each package, in package order (one query)."""
    link = m.HealthPackageTest
    stmt = (
        select(col(link.package_id), m.LabTest)
        .select_from(link)
        .join(m.LabTest, col(m.LabTest.id) == col(link.lab_test_id))
        .where(col(link.package_id).in_(package_ids), col(m.LabTest.is_active))
        .order_by(col(link.package_id), col(link.sort_order))
    )
    result: dict[uuid.UUID, list[m.LabTest]] = defaultdict(list)
    for package_id, test in session.exec(stmt):
        result[package_id].append(test)
    return result
