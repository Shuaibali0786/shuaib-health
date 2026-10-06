"""Command Centre reads over the real database (staff sessions only)."""

from sqlalchemy import text
from sqlmodel import Session

READ_TIMEOUT = "3s"


def apply_read_timeout(db: Session) -> None:
    """Bound one admin read to three seconds; ``SET LOCAL`` ends with the transaction."""
    db.execute(text(f"SET LOCAL statement_timeout = '{READ_TIMEOUT}'"))


class RealSource:
    def __init__(self, db: Session) -> None:
        self.db = db
        apply_read_timeout(db)
