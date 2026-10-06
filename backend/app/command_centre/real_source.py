"""Command Centre reads over the real database (staff sessions only)."""

from datetime import datetime
from zoneinfo import ZoneInfo

from sqlalchemy import text
from sqlmodel import Session

from app.command_centre import service
from app.command_centre.schemas import BookingDetail, BookingPage, BookingSearchRequest, Lookups

READ_TIMEOUT = "3s"


def apply_read_timeout(db: Session) -> None:
    """Bound one admin read to three seconds; ``SET LOCAL`` ends with the transaction."""
    db.execute(text(f"SET LOCAL statement_timeout = '{READ_TIMEOUT}'"))


class RealSource:
    def __init__(self, db: Session) -> None:
        self.db = db
        apply_read_timeout(db)

    def search(self, body: BookingSearchRequest, tz: ZoneInfo, now: datetime) -> BookingPage:
        return service.search(self.db, body, tz, now)

    def detail(self, reference: str, tz: ZoneInfo, now: datetime) -> BookingDetail:
        return service.detail(self.db, reference, tz, now)

    def lookups(self) -> Lookups:
        return service.lookups(self.db)
