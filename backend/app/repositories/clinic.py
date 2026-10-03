"""Clinic settings and rules queries."""

from collections.abc import Sequence

from sqlmodel import Session, col, select

from app import models as m
from app.repositories._common import paginate


def get_clinic_settings(session: Session) -> m.ClinicSettings | None:
    return session.exec(select(m.ClinicSettings)).first()


def list_rules(session: Session, page: int, page_size: int) -> tuple[Sequence[m.ClinicRule], int]:
    stmt = (
        select(m.ClinicRule)
        .where(col(m.ClinicRule.is_active))
        .order_by(col(m.ClinicRule.sort_order), col(m.ClinicRule.id))
    )
    return paginate(session, stmt, page, page_size)
