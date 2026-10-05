"""Query helpers shared by the repositories.

Every catalog request is one database round trip: the total row count comes from a window
function in the page query, and related rows are fetched by correlated aggregate subqueries.
"""

import uuid
from typing import Any

from sqlalchemy import Select, func
from sqlalchemy.orm import Session as OrmSession
from sqlmodel import Session, select

WEEKDAY_ORDER = {"mon": 1, "tue": 2, "wed": 3, "thu": 4, "fri": 5, "sat": 6, "sun": 7}
LIKE_ESCAPE = "\\"

Row = tuple[Any, ...]


def escape_like(term: str) -> str:
    """Make ``term`` a literal ``%term%`` LIKE pattern (wildcards and the escape char escaped)."""
    escaped = (
        term.replace(LIKE_ESCAPE, LIKE_ESCAPE * 2)
        .replace("%", LIKE_ESCAPE + "%")
        .replace("_", LIKE_ESCAPE + "_")
    )
    return f"%{escaped}%"


def paginate(
    session: Session, stmt: Select[Any], page: int, page_size: int
) -> tuple[list[Row], int]:
    """Return one page of ``stmt`` (filtered and ordered) plus the total matching rows.

    The total rides along as a window ``count(*)`` so a normal request needs a single query.
    Only a page past the end of the results needs a second query to learn the total.
    """
    windowed = stmt.add_columns(func.count().over().label("total_count"))
    # SQLAlchemy's execute (not SQLModel's exec): exec would return only the first column for a
    # single-entity statement, dropping the total.
    page_stmt = windowed.limit(page_size).offset((page - 1) * page_size)
    fetched = OrmSession.execute(session, page_stmt).all()
    if fetched:
        return [tuple(row)[:-1] for row in fetched], int(fetched[0][-1])
    if page == 1:
        return [], 0
    total = session.exec(select(func.count()).select_from(stmt.order_by(None).subquery())).one()
    return [], int(total)


def require_id(value: uuid.UUID | None) -> uuid.UUID:
    if value is None:
        raise RuntimeError("row has no id")
    return value


def require_value[T](value: T | None) -> T:
    if value is None:
        raise RuntimeError("row is missing a stored value")
    return value
