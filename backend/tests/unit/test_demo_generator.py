"""The demo dataset: deterministic, department-realistic, and fast (FR-038, data-model §9)."""

import re
import time
from collections import Counter
from datetime import UTC, date, datetime, timedelta
from zoneinfo import ZoneInfo

from app.demo import generator, names
from app.demo.demo_source import DemoSource
from app.demo.generator import DemoDataset

CLINIC_ZONE = ZoneInfo("Asia/Karachi")
TODAY = date(2026, 10, 5)  # a Monday
NOW = datetime(2026, 10, 5, 6, 20, 45, tzinfo=UTC)  # 11:20:45 in Karachi
CROCKFORD = set("0123456789ABCDEFGHJKMNPQRSTVWXYZ")
AMBIGUOUS = set("01OIL")


def local_date(booking: generator.DemoBooking) -> date:
    return booking.starts_at.astimezone(CLINIC_ZONE).date()


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
    assert not any(set(r) & AMBIGUOUS for r in refs)  # no 0/O, 1/I/L to misread
    assert all(b.is_sample for b in ds.bookings)
    assert all(re.fullmatch(r"\+923[0-9]{2}000[0-9]{4}", b.phone) for b in ds.bookings)


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
            if b.closed_at <= NOW:
                assert status in {"completed", "no_show"}
            elif b.arrived_at <= NOW and b.outcome != "no_show":
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
    names = {s.display_name for s in ds.staff}
    day_start = datetime(2026, 10, 5, tzinfo=CLINIC_ZONE)
    assert len(names) >= 4 and not any(n.startswith("Sample") for n in names)
    assert all(s.job_title for s in ds.staff)
    assert all(
        day_start - timedelta(days=7) < s.last_sign_in_at < day_start + timedelta(days=1)
        for s in ds.staff
    )
    assert ds.activity
    assert {a.staff_name for a in ds.activity} <= names
    times = [a.occurred_at for a in ds.activity]
    assert times == sorted(times, reverse=True)


def test_generation_is_fast() -> None:
    generator.build_dataset(date(2026, 11, 2))  # warm: the catalog file is read once
    started = time.perf_counter()
    generator.build_dataset(date(2026, 11, 3))
    # Generation is ~0.1-0.2 s on a dev laptop; 0.5 s leaves headroom for slow
    # or loaded CI machines while still catching an accidental O(n^2) regression.
    assert time.perf_counter() - started < 0.5


# ----- the activity feed agrees with the day (arrivals, completions, sign-ins) -------------------

OPENING = datetime(2026, 10, 5, 9, 0, tzinfo=CLINIC_ZONE)
SHOWN_AT = [
    datetime(2026, 10, 5, h, m, tzinfo=CLINIC_ZONE)
    for h, m in ((9, 0), (9, 5), (10, 30), (11, 20), (12, 30), (15, 0), (19, 59))
]


def status_events(ds: DemoDataset) -> dict[tuple[str, str | None], generator.DemoActivity]:
    return {
        (e.target_reference or "", e.to_status): e
        for e in ds.activity
        if e.action == "booking.status_changed"
    }


def test_no_event_precedes_opening_and_every_actor_has_signed_in_that_day() -> None:
    ds = dataset()
    sign_ins: dict[tuple[str, date], datetime] = {}
    for e in sorted(ds.activity, key=lambda item: item.occurred_at):
        day = e.occurred_at.astimezone(CLINIC_ZONE).date()
        opening = datetime.combine(day, OPENING.timetz(), tzinfo=CLINIC_ZONE)
        assert e.occurred_at >= opening, e
        if e.action == "auth.sign_in":
            sign_ins.setdefault((e.staff_name, day), e.occurred_at)
        else:
            assert (e.staff_name, day) in sign_ins, e
            assert sign_ins[(e.staff_name, day)] < e.occurred_at, e


def test_status_events_follow_each_bookings_own_slot() -> None:
    ds = dataset()
    by_ref = {b.reference: b for b in ds.bookings}
    events = status_events(ds)
    assert events
    for (ref, to_status), e in events.items():
        b = by_ref[ref]
        assert b.outcome != "cancelled"
        if to_status == "arrived":
            assert e.occurred_at == b.arrived_at
            assert e.from_status == "confirmed" and b.outcome == "completed"
            early = b.starts_at - e.occurred_at
            opening_floor = b.arrived_at == datetime.combine(
                local_date(b), OPENING.timetz(), tzinfo=CLINIC_ZONE
            ) + timedelta(minutes=generator.FIRST_ARRIVAL_MINUTES)
            assert opening_floor or timedelta(minutes=5) <= early <= timedelta(minutes=15)
            assert e.occurred_at < b.ends_at
        else:
            assert to_status == b.outcome and to_status in {"completed", "no_show"}
            assert e.occurred_at >= b.ends_at  # only after the slot has ended
            assert e.occurred_at <= b.ends_at + timedelta(minutes=10)
            if to_status == "completed":
                assert e.from_status == "arrived"
                assert events[(ref, "arrived")].occurred_at < e.occurred_at
    # every visit of the last week that is not cancelled has its events
    week = [b for b in ds.bookings if TODAY - timedelta(days=6) <= local_date(b) <= TODAY]
    for b in week:
        if b.outcome == "completed":
            assert (b.reference, "arrived") in events and (b.reference, "completed") in events
        elif b.outcome == "no_show":
            assert (b.reference, "no_show") in events


def test_the_example_visit_cannot_complete_before_its_slot() -> None:
    """The reported bug: a 10:15 visit shown Completed at 08:51."""
    ds = dataset()
    for b in ds.bookings:
        if local_date(b) == TODAY and b.outcome == "completed":
            assert b.closed_at > b.starts_at
            assert b.status_at(b.starts_at) != "completed"


def test_the_feed_is_never_in_the_future_and_runs_on_with_the_clock() -> None:
    source = DemoSource(TODAY)
    seen = []
    for shown in SHOWN_AT:
        now = shown.astimezone(UTC)
        events = []
        page = 1
        while True:
            answer = source.activity(action=None, staff_id=None, page=page, now=now)
            events += answer.items
            if len(events) >= answer.total:
                break
            page += 1
        assert all(e.at <= now for e in events)
        seen.append(len(events))
        today_events = [e for e in events if e.at >= OPENING]
        if shown.hour >= 11:
            assert max(e.at for e in today_events) > shown - timedelta(minutes=30)
    assert seen == sorted(seen) and seen[0] < seen[-1]


def test_staff_last_sign_in_is_their_latest_signed_in_event() -> None:
    source = DemoSource(TODAY)
    ds = source.dataset
    for shown in SHOWN_AT:
        now = shown.astimezone(UTC)
        feed = [e for e in ds.activity if e.action == "auth.sign_in" and e.occurred_at <= now]
        for member in source.staff(now):
            mine = [e.occurred_at for e in feed if e.staff_name == member.display_name]
            assert mine, f"{member.display_name} has no sign-in by {shown}"
            assert member.last_sign_in_at == max(mine)
            assert member.last_sign_in_at <= now
    # the dataset's own value is the latest of the whole feed
    for member in ds.staff:
        mine = [
            e.occurred_at
            for e in ds.activity
            if e.action == "auth.sign_in" and e.staff_name == member.display_name
        ]
        assert member.last_sign_in_at == max(mine)


def test_the_clinic_manager_is_in_today_and_the_part_timer_is_not() -> None:
    ds = dataset()
    by_title = {s.job_title: s for s in ds.staff}
    manager = by_title[generator.MANAGER_TITLE]
    assert manager.last_sign_in_at >= OPENING
    first_action = min(
        (
            e.occurred_at
            for e in ds.activity
            if e.staff_name == manager.display_name
            and e.action != "auth.sign_in"
            and e.occurred_at >= OPENING
        ),
        default=None,
    )
    assert first_action is None or manager.last_sign_in_at < first_action
    assert by_title[generator.PART_TIME_TITLE].last_sign_in_at < OPENING


def test_whoever_acts_today_signed_in_today() -> None:
    source = DemoSource(TODAY)
    now = datetime(2026, 10, 5, 17, 0, tzinfo=CLINIC_ZONE).astimezone(UTC)
    actors = {
        e.actor_name
        for e in source.activity(action=None, staff_id=None, page=1, now=now).items
        if e.at >= OPENING
    }
    assert actors
    today = {m.display_name for m in source.staff(now) if m.last_sign_in_at >= OPENING}
    assert actors <= today
