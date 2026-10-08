"""The demo's own "now": real inside clinic hours, the sample day at 12:30 outside them."""

from datetime import UTC, date, datetime, timedelta

from app.demo.clock import demo_now
from app.demo.generator import CLINIC_ZONE

DAY = date(2026, 10, 5)


def karachi(hour: int, minute: int = 0, day: date = DAY) -> datetime:
    return datetime(day.year, day.month, day.day, hour, minute, tzinfo=CLINIC_ZONE).astimezone(UTC)


def test_inside_clinic_hours_the_real_time_is_used() -> None:
    for real in (karachi(9), karachi(12, 30), karachi(19, 59)):
        shown = demo_now(real, DAY, started_at=real)
        assert shown.at == real and shown.typical is False


def test_outside_clinic_hours_the_day_stands_at_half_past_twelve() -> None:
    for real in (karachi(3, 40), karachi(8, 59), karachi(20), karachi(23, 15)):
        shown = demo_now(real, DAY, started_at=real)
        assert shown.at == karachi(12, 30) and shown.typical is True


def test_the_sample_day_runs_on_from_the_start_of_the_demo() -> None:
    started = karachi(22, 0)
    shown = demo_now(started + timedelta(minutes=47), DAY, started_at=started)
    assert shown.at == karachi(13, 17) and shown.typical is True


def test_a_demo_that_crosses_midnight_stays_on_its_own_day() -> None:
    started = karachi(23, 30)
    shown = demo_now(started + timedelta(hours=1), DAY, started_at=started)  # 00:30 next day
    assert shown.at.astimezone(CLINIC_ZONE).date() == DAY and shown.typical is True
