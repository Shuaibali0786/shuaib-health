"""Pure helpers shared by the real and the demo data sources (no database imports)."""

from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from app.command_centre.schemas import BookingSearchRequest, PhoneReveal


def day_bounds(day: date, tz: ZoneInfo) -> tuple[datetime, datetime]:
    start = datetime.combine(day, time(0, 0), tzinfo=tz)
    return start, datetime.combine(day + timedelta(days=1), time(0, 0), tzinfo=tz)


def resolve_range(body: BookingSearchRequest, today: date) -> tuple[date, date]:
    """No dates means today; one date means that single day."""
    first = body.from_ or body.to or today
    return first, body.to or first


def format_phone(e164: str) -> PhoneReveal:
    local = "0" + e164.removeprefix("+92")
    return PhoneReveal(phone=f"{local[:4]} {local[4:]}", tel_href=f"tel:{e164}")
