"""The demo dataset: deterministic, department-realistic, and fast (FR-038, data-model §9)."""

import time
from collections import Counter
from datetime import UTC, date, datetime, timedelta
from zoneinfo import ZoneInfo

from app.demo import generator, names
from app.demo.generator import DemoDataset

KARACHI = ZoneInfo("Asia/Karachi")
TODAY = date(2026, 10, 5)  # a Monday
NOW = datetime(2026, 10, 5, 6, 20, 45, tzinfo=UTC)  # 11:20:45 in Karachi
CROCKFORD = set("0123456789ABCDEFGHJKMNPQRSTVWXYZ")


def local_date(booking: generator.DemoBooking) -> date:
    return booking.starts_at.astimezone(KARACHI).date()


def dataset() -> DemoDataset:
    return generator.build_dataset(TODAY)


def test_same_date_gives_an_identical_dataset() -> None:
    first, second = generator.build_dataset(TODAY), generator.build_dataset(TODAY)
    assert first is not second
    assert first.bookings == second.bookings
    assert generator.build_dataset(TODAY + timedelta(days=1)).bookings != first.bookings


def test_cached_dataset_is_reused_for_the_same_date() -> None:
    assert generator.get_dataset(TODAY) is generator.get_dataset(TODAY)


def test_range_references_and_sample_flag() -> None:
    ds = dataset()
    days = {local_date(b) for b in ds.bookings}
    assert min(days) >= TODAY - timedelta(days=90) and max(days) <= TODAY + timedelta(days=14)
    assert TODAY in days
    refs = [b.reference for b in ds.bookings]
    assert len(refs) == len(set(refs))
    assert all(len(r) == 10 and r[0] == "D" and set(r[1:]) <= CROCKFORD for r in refs)
    assert all(b.is_sample for b in ds.bookings)
    assert all(b.phone.startswith("+92300000") and len(b.phone) == 13 for b in ds.bookings)


def test_no_double_booked_slots() -> None:
    seen: set[tuple[str, datetime]] = set()
    for b in dataset().bookings:
        key = (b.doctor_slug, b.starts_at)
        assert key not in seen
        seen.add(key)


def test_patients_fit_their_department() -> None:
    by_dept: Counter[str] = Counter()
    for b in dataset().bookings:
        by_dept[b.department] += 1
        assert b.reason in names.REASONS[b.department]
        if b.department == "Gynecology":
            assert b.patient_gender == "female" and 21 <= b.patient_age <= 46
            assert b.booked_by is None
        elif b.department == "Pediatrics":
            assert 0 <= b.patient_age <= 12
            assert b.booked_by in {"mother", "father"}
        else:
            assert b.booked_by is None
        if b.department == "Cardiology":
            assert 38 <= b.patient_age <= 78
    assert by_dept["Gynecology"] > 100 and by_dept["Pediatrics"] > 100


def test_past_days_are_fully_resolved_with_realistic_rates() -> None:
    past = [b for b in dataset().bookings if local_date(b) < TODAY]
    assert len(past) > 1500
    statuses = Counter(b.status_at(NOW) for b in past)
    assert set(statuses) <= {"completed", "no_show", "cancelled"}
    total = len(past)
    assert abs(statuses["no_show"] / total - 0.08) < 0.02
    assert abs(statuses["cancelled"] / total - 0.06) < 0.02


def test_today_is_split_by_now_and_future_is_confirmed() -> None:
    ds = dataset()
    for b in ds.bookings:
        status = b.status_at(NOW)
        if local_date(b) == TODAY and status != "cancelled":
            end = b.starts_at + timedelta(minutes=generator.SLOT_MINUTES)
            if end <= NOW:
                assert status in {"completed", "no_show"}
            elif b.starts_at <= NOW:
                assert status == "arrived"
            else:
                assert status == "confirmed"
        elif local_date(b) > TODAY:
            assert status in {"confirmed", "cancelled"}
    today = [b for b in ds.bookings if local_date(b) == TODAY]
    assert 20 <= len(today) <= 90  # a busy, believable Monday
    assert {"confirmed", "completed"} <= {b.status_at(NOW) for b in today}


def test_future_cancel_rate() -> None:
    future = [b for b in dataset().bookings if local_date(b) > TODAY]
    cancelled = sum(b.status_at(NOW) == "cancelled" for b in future)
    assert abs(cancelled / len(future) - 0.06) < 0.03


def test_mondays_and_saturdays_are_busy() -> None:
    per_day = Counter(local_date(b) for b in dataset().bookings if local_date(b) <= TODAY)
    weekdays: dict[int, list[int]] = {d: [] for d in range(7)}
    for day, count in per_day.items():
        weekdays[day.weekday()].append(count)
    mean = {d: sum(v) / len(v) for d, v in weekdays.items() if v}
    assert max(mean[0], mean[5]) >= sum(mean.values()) / len(mean)


def test_staff_and_activity_are_synthetic() -> None:
    ds = dataset()
    assert {s.display_name for s in ds.staff} == {
        "Sample Admin",
        "Sample Receptionist A",
        "Sample Receptionist B",
    }
    assert ds.activity
    assert all(a.staff_name.startswith("Sample ") for a in ds.activity)
    times = [a.occurred_at for a in ds.activity]
    assert times == sorted(times, reverse=True)


def test_generation_is_fast() -> None:
    generator.build_dataset(date(2026, 11, 2))  # warm: the catalog file is read once
    started = time.perf_counter()
    generator.build_dataset(date(2026, 11, 3))
    assert time.perf_counter() - started < 0.15
