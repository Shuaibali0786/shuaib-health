"""Query helpers shared by the repositories."""

import uuid
from collections.abc import Sequence

from sqlalchemy import func
from sqlmodel import Session, select
from sqlmodel.sql.expression import SelectOfScalar

WEEKDAY_ORDER = {"mon": 1, "tue": 2, "wed": 3, "thu": 4, "fri": 5, "sat": 6, "sun": 7}
LIKE_ESCAPE = "\\"


def escape_like(term: str) -> str:
    """Make ``term`` a literal ``%term%`` LIKE pattern (``%``, ``_`` and ``\`` are escaped)."""
    escaped = (
        term.replace(LIKE_ESCAPE, LIKE_ESCAPE * 2)
        .replace("%", LIKE_ESCAPE + "%")
        .replace("_", LIKE_ESCAPE + "_")
    )
    return f"%{escaped}%"


def paginate[T](
    session: Session, stmt: SelectOfScalar[T], page: int, page_size: int
) -> tuple[Sequence[T], int]:
    """Return one page of ``stmt`` plus the total number of matching rows."""
    total = session.exec(select(func.count()).select_from(stmt.order_by(None).subquery())).one()
    rows = session.exec(stmt.limit(page_size).offset((page - 1) * page_size)).all()
    return rows, total


def require_id(value: uuid.UUID | None) -> uuid.UUID:
    if value is None:
        raise RuntimeError("row has no id")
    return value
