"""The deterministic demo dataset (ADR-0009, data-model §9). In memory only.

Built from the public sample catalog files and a PRNG seeded with the clinic-local date, so the same
date always gives the same clinic. This module must not import the database, the models or a
repository (SC-005; ``tests/unit/test_demo_import_guard.py``).

A booking stores what *will* happen (``outcome``); its status at a given instant is derived by
``status_at``, so one dataset serves a visitor at 09:00 and at 17:00.
"""

import hashlib
import json
import random
import uuid
from dataclasses import dataclass, field, replace
from datetime import UTC, date, datetime, time, timedelta
from functools import cache, lru_cache
from pathlib import Path
from typing import Any, Final, Literal
from zoneinfo import ZoneInfo

from app.booking.reference import SAFE_ALPHABET
from app.demo import names

SEED_DATA = Path(__file__).resolve().parent.parent / "seed" / "data"
SEED_PREFIX = "shuaib-health-demo:v1:"
CROCKFORD: Final = SAFE_ALPHABET  # demo references use unambiguous characters only
OPENING_MINUTE = 9 * 60  # the desk opens at 09:00 (demo clock); nothing is recorded before it
FIRST_ARRIVAL_MINUTES = 3  # the first arrival is after the first person has signed in
SIGN_IN_SPREAD_MINUTES = 40  # everyone else signs in within this many minutes of opening
ACTIVITY_DAYS = 7
MANAGER_TITLE = "Clinic Manager"  # always signed in on the latest day of the feed
PART_TIME_TITLE = "Receptionist"  # never on the latest day, so one sign-in is older
DAYS_BACK = 90
DAYS_FORWARD = 14
WEEKDAYS: Final = ("mon", "tue", "wed", "thu", "fri", "sat", "sun")

Status = Literal["confirmed", "arrived", "completed", "no_show", "cancelled"]
Outcome = Literal["completed", "no_show", "cancelled"]
Gender = Literal["female", "male"]


def _read(name: str) -> dict[str, Any]:
    data: dict[str, Any] = json.loads((SEED_DATA / name).read_text(encoding="utf-8"))
    return data


@cache
def _catalog() -> tuple[dict[str, Any], int, str]:
    catalog = _read("catalog.json")
    extras = _read("extras.json")
    slot = int(str(extras["defaultSlotMinutes"]))
    digest = hashlib.sha256()
    for name in ("catalog.json", "extras.json"):
        # Line endings differ between a Windows and a Linux checkout; the hash must not.
        digest.update((SEED_DATA / name).read_bytes().replace(b"\r\n", b"\n"))
    return catalog, slot, digest.hexdigest()[:16]


SLOT_MINUTES = _catalog()[1]
CLINIC_TZ_NAME: str = _catalog()[0]["siteConfig"]["timeZone"]
CLINIC_ZONE = ZoneInfo(CLINIC_TZ_NAME)


def catalog_etag() -> str:
    return _catalog()[2]


@dataclass(frozen=True, slots=True)
class DemoDoctor:
    slug: str
    name: str
    department: str
    fee_pkr: int
    # weekday index (Mon = 0) -> ((start minute, end minute), ...)
    sessions: dict[int, tuple[tuple[int, int], ...]]


@dataclass(frozen=True, slots=True)
class DemoBooking:
    reference: str
    doctor_slug: str
    doctor_name: str
    department: str
    starts_at: datetime
    outcome: Outcome
    patient_first: str
    patient_last: str
    patient_age: int
    patient_gender: Gender
    booked_by: Literal["mother", "father"] | None
    phone: str
    email: str
    reason: str
    fee_pkr: int
    created_at: datetime
    #: When the patient is marked arrived: 5-15 minutes before the slot, once the desk is open.
    arrived_at: datetime
    #: When the visit is closed (completed or no-show): a few minutes after the slot ends.
    closed_at: datetime
    is_sample: bool = True

    @property
    def ends_at(self) -> datetime:
        return self.starts_at + timedelta(minutes=SLOT_MINUTES)

    def status_at(self, now: datetime) -> Status:
        """Cancelled stays cancelled; otherwise the booking moves with the clock.

        These are the instants the activity feed records the changes, so the two always agree. A
        no-show never arrives: it stays confirmed until the desk marks it.
        """
        if self.outcome == "cancelled":
            return "cancelled"
        if self.closed_at <= now:
            return self.outcome
        if self.outcome != "no_show" and self.arrived_at <= now:
            return "arrived"
        return "confirmed"


@dataclass(frozen=True, slots=True)
class DemoStaff:
    id: uuid.UUID
    display_name: str
    role: Literal["admin", "receptionist"]
    email: str
    job_title: str
    last_sign_in_at: datetime


@dataclass(frozen=True, slots=True)
class DemoActivity:
    occurred_at: datetime
    staff_name: str
    role: Literal["admin", "receptionist"]
    action: str
    target_reference: str | None = None
    from_status: Status | None = None
    to_status: Status | None = None
    network_tag: str = ""


@dataclass(frozen=True, slots=True)
class DemoDataset:
    demo_date: date
    catalog_etag: str
    doctors: tuple[DemoDoctor, ...]
    bookings: tuple[DemoBooking, ...]
    leave: frozenset[tuple[str, date]]
    holidays: dict[date, str]
    staff: tuple[DemoStaff, ...]
    activity: tuple[DemoActivity, ...] = field(default=())


def _minutes(hhmm: object) -> int:
    hours, minutes = str(hhmm).split(":")
    return int(hours) * 60 + int(minutes)


def _doctors() -> tuple[DemoDoctor, ...]:
    catalog = _catalog()[0]
    departments = {d["id"]: d["name"] for d in catalog["departments"]}
    out: list[DemoDoctor] = []
    for doc in catalog["doctors"]:
        sessions: dict[int, list[tuple[int, int]]] = {}
        for item in doc["schedule"]:
            day = WEEKDAYS.index(item["day"])
            sessions.setdefault(day, []).append((_minutes(item["start"]), _minutes(item["end"])))
        out.append(
            DemoDoctor(
                slug=doc["slug"],
                name=doc["fullName"],
                department=departments[doc["departmentId"]],
                fee_pkr=int(doc["feePkr"]),
                sessions={d: tuple(sorted(s)) for d, s in sessions.items()},
            )
        )
    return tuple(out)


def _local_midnight(day: date) -> datetime:
    return datetime.combine(day, time(0, 0), tzinfo=CLINIC_ZONE).astimezone(UTC)


def _pick[T](rnd: random.Random, items: tuple[T, ...]) -> T:
    return items[int(rnd.random() * len(items))]


_RANK: Final = {c: i for i, c in enumerate(CROCKFORD)}


def _reference(rnd: random.Random, taken: set[str]) -> str:
    while True:
        ref = "D" + "".join(CROCKFORD[int(rnd.random() * len(CROCKFORD))] for _ in range(9))
        if ref not in taken:
            taken.add(ref)
            return ref


def _outcome(rnd: random.Random) -> Outcome:
    roll = rnd.random()
    if roll < 0.06:
        return "cancelled"
    if roll < 0.14:
        return "no_show"
    return "completed"


def _patient(
    rnd: random.Random, department: str
) -> tuple[str, str, int, Gender, Literal["mother", "father"] | None, str]:
    who, (low, high) = names.PROFILES[department]
    age = low + int(rnd.random() * (high - low + 1))
    female = True if who == "woman" else rnd.random() < 0.5
    if who == "child":
        first = _pick(rnd, names.GIRLS if female else names.BOYS)
        booked_by: Literal["mother", "father"] | None = "mother" if rnd.random() < 0.7 else "father"
        contact = _pick(rnd, names.WOMEN if booked_by == "mother" else names.MEN)
    else:
        first = _pick(rnd, names.WOMEN if female else names.MEN)
        booked_by = None
        contact = first
    return (
        first,
        _pick(rnd, names.SURNAMES),
        age,
        "female" if female else "male",
        booked_by,
        contact,
    )


def _slots(doctor: DemoDoctor, weekday: int) -> list[int]:
    return [
        start
        for begin, end in doctor.sessions.get(weekday, ())
        for start in range(begin, end - SLOT_MINUTES + 1, SLOT_MINUTES)
    ]


OPERATOR_CODES: Final = ("00", "01", "15", "21", "31", "33", "40", "45")


def _phone(serial: int) -> str:
    """A sample mobile number in the 0300-0345 ranges; ``example`` numbers, never real ones."""
    return f"+923{OPERATOR_CODES[serial % len(OPERATOR_CODES)]}000{serial:04d}"


def _opening(day: date) -> datetime:
    return _local_midnight(day) + timedelta(minutes=OPENING_MINUTE)


def never_signed_in(today: date) -> datetime:
    """Where a sign-in sits when the feed holds none for a person: the opening a week ago."""
    return _opening(today - timedelta(days=ACTIVITY_DAYS + 1))


def _staff(today: date) -> tuple[DemoStaff, ...]:
    return tuple(
        DemoStaff(
            uuid.uuid5(uuid.NAMESPACE_URL, f"{SEED_PREFIX}staff:{email}"),
            name,
            role,  # type: ignore[arg-type]
            email,
            job_title,
            never_signed_in(today),
        )
        for name, role, email, job_title in names.STAFF
    )


def last_sign_in(
    activity: tuple[DemoActivity, ...], member: DemoStaff, fallback: datetime, now: datetime | None
) -> datetime:
    """The latest "Signed in" event of ``member`` by ``now`` (ever, if None), else ``fallback``."""
    return max(
        (
            e.occurred_at
            for e in activity
            if e.action == "auth.sign_in"
            and e.staff_name == member.display_name
            and (now is None or e.occurred_at <= now)
        ),
        default=fallback,
    )


def _bookings(
    rnd: random.Random,
    today: date,
    doctors: tuple[DemoDoctor, ...],
    leave: set[tuple[str, date]],
    holidays: dict[date, str],
) -> list[DemoBooking]:
    taken: set[str] = set()
    out: list[DemoBooking] = []
    today_start = _local_midnight(today)
    for offset in range(-DAYS_BACK, DAYS_FORWARD + 1):
        day = today + timedelta(days=offset)
        if day in holidays:
            continue
        weekday = day.weekday()
        working = [d for d in doctors if d.sessions.get(weekday)]
        if working and offset != 0 and rnd.random() < 0.10:
            leave.add((_pick(rnd, tuple(working)).slug, day))
        midnight = _local_midnight(day)
        for doctor in working:
            if (doctor.slug, day) in leave:
                continue
            fill = min(0.95, max(0.35, rnd.gauss(0.72, 0.12)) + (0.10 if weekday in (0, 5) else 0))
            for start in _slots(doctor, weekday):
                p = fill * (1.08 if start < 13 * 60 else 0.92)
                if rnd.random() >= p:
                    continue
                first, last, age, gender, booked_by, contact = _patient(rnd, doctor.department)
                starts_at = midnight + timedelta(minutes=start)
                lead = timedelta(days=1 + int(rnd.random() * 4), minutes=int(rnd.random() * 600))
                created_at = min(
                    starts_at - lead, today_start - timedelta(minutes=int(rnd.random() * 2880))
                )
                reference = _reference(rnd, taken)
                # The visit's own timeline comes from its reference, so it needs no extra draws.
                arrives_early = 5 + _RANK[reference[1]] % 11
                closes_after = 1 + _RANK[reference[2]] % 10
                out.append(
                    DemoBooking(
                        reference=reference,
                        doctor_slug=doctor.slug,
                        doctor_name=doctor.name,
                        department=doctor.department,
                        starts_at=starts_at,
                        outcome=_outcome(rnd),
                        patient_first=first,
                        patient_last=last,
                        patient_age=age,
                        patient_gender=gender,
                        booked_by=booked_by,
                        phone=_phone(int(rnd.random() * 10000)),
                        email=f"{contact.lower()}{int(rnd.random() * 90) + 10}@example.com",
                        reason=_pick(rnd, names.REASONS[doctor.department]),
                        fee_pkr=doctor.fee_pkr,
                        created_at=created_at,
                        arrived_at=max(
                            starts_at - timedelta(minutes=arrives_early),
                            midnight + timedelta(minutes=OPENING_MINUTE + FIRST_ARRIVAL_MINUTES),
                        ),
                        closed_at=starts_at + timedelta(minutes=SLOT_MINUTES + closes_after),
                    )
                )
    return out


def _roster(
    rnd: random.Random, staff: tuple[DemoStaff, ...], days: list[date]
) -> dict[date, dict[int, datetime]]:
    """Who works each day and when they sign in: the first at the desk within two minutes of
    opening, the rest within ``SIGN_IN_SPREAD_MINUTES``."""
    duty: dict[date, set[int]] = {}
    for day in days:
        chosen = {i for i in range(len(staff)) if rnd.random() < 0.6}
        while len(chosen) < 2:
            chosen.add(int(rnd.random() * len(staff)))
        duty[day] = chosen
    # The clinic manager is in on the latest (busy) day so the Staff page never shows them idle;
    # the part-time receptionist is off that day, so the page still shows an older sign-in.
    if len(days) > 1:
        latest = duty[days[0]]
        for i, member in enumerate(staff):
            if member.job_title == MANAGER_TITLE:
                latest.add(i)
            elif member.job_title == PART_TIME_TITLE:
                latest.discard(i)
        while len(latest) < 2:
            latest.add(int(rnd.random() * len(staff)))
            latest.difference_update(
                i for i, m in enumerate(staff) if m.job_title == PART_TIME_TITLE
            )
    # Everyone signed in on some day before the latest one, so a last sign-in is always known,
    # whatever time of day the demo is shown.
    earlier = days[1:] or days
    for i in range(len(staff)):
        if not any(i in duty[day] for day in earlier):
            duty[earlier[i % len(earlier)]].add(i)
    roster: dict[date, dict[int, datetime]] = {}
    for day in days:
        opening = _opening(day)
        order = sorted(duty[day])
        rnd.shuffle(order)
        signed: dict[int, datetime] = {}
        for rank, i in enumerate(order):
            seconds = (
                int(rnd.random() * 120)
                if rank == 0
                else FIRST_ARRIVAL_MINUTES * 60 + int(rnd.random() * SIGN_IN_SPREAD_MINUTES * 60)
            )
            signed[i] = opening + timedelta(seconds=seconds)
        roster[day] = signed
    return roster


def _activity(
    rnd: random.Random, today: date, staff: tuple[DemoStaff, ...], bookings: list[DemoBooking]
) -> tuple[DemoActivity, ...]:
    """The last week of the desk's log, built from the visits themselves.

    Every status change is stamped with the booking's own ``arrived_at`` / ``closed_at``; nobody
    acts before they have signed in, and nothing is stamped before the desk opens. The whole of
    today is generated; the demo shows only what has happened by its own "now".
    """
    by_day: dict[date, list[DemoBooking]] = {}
    for booking in bookings:
        if booking.outcome != "cancelled":
            by_day.setdefault(booking.starts_at.astimezone(CLINIC_ZONE).date(), []).append(booking)
    days = [
        d for d in (today - timedelta(days=back) for back in range(ACTIVITY_DAYS)) if by_day.get(d)
    ]
    if not days:
        return ()
    roster = _roster(rnd, staff, days)
    events: list[DemoActivity] = []
    for day in days:
        signed = roster[day]

        def tag(who: DemoStaff, day: date = day) -> str:
            return hashlib.sha256(f"{who.email}:{day}".encode()).hexdigest()[:6]

        def actor(at: datetime, signed: dict[int, datetime] = signed) -> DemoStaff:
            ready = [i for i, since in sorted(signed.items()) if since < at]
            return staff[_pick(rnd, tuple(ready or [min(signed, key=signed.__getitem__)]))]

        for i, at in signed.items():
            who = staff[i]
            events.append(
                DemoActivity(at, who.display_name, who.role, "auth.sign_in", network_tag=tag(who))
            )
        first_arrival = _opening(day) + timedelta(minutes=FIRST_ARRIVAL_MINUTES)
        for booking in by_day[day]:
            changes: list[tuple[datetime, Status, Status]] = []
            if booking.outcome == "completed":
                changes.append((booking.arrived_at, "confirmed", "arrived"))
                changes.append((booking.closed_at, "arrived", "completed"))
            else:
                changes.append((booking.closed_at, "confirmed", booking.outcome))
            for at, before, after in changes:
                who = actor(at)
                events.append(
                    DemoActivity(
                        at,
                        who.display_name,
                        who.role,
                        "booking.status_changed",
                        booking.reference,
                        before,
                        after,
                        tag(who),
                    )
                )
            if rnd.random() < 0.3:  # the desk rings the patient before the visit
                at = max(
                    first_arrival, booking.starts_at - timedelta(minutes=int(rnd.random() * 180))
                )
                who = actor(at)
                events.append(
                    DemoActivity(
                        at,
                        who.display_name,
                        who.role,
                        "booking.phone_revealed",
                        booking.reference,
                        network_tag=tag(who),
                    )
                )
    events.sort(key=lambda e: e.occurred_at, reverse=True)
    return tuple(events)


def build_dataset(demo_date: date) -> DemoDataset:
    """A fresh dataset for ``demo_date`` (clinic-local date). Prefer ``get_dataset`` (cached)."""
    rnd = random.Random(SEED_PREFIX + demo_date.isoformat())  # noqa: S311 - deterministic sample data, not security
    doctors = _doctors()
    leave: set[tuple[str, date]] = set()
    holidays = {demo_date + timedelta(days=6): "Clinic closed (sample holiday)"}
    bookings = _bookings(rnd, demo_date, doctors, leave, holidays)
    activity = _activity(rnd, demo_date, _staff(demo_date), bookings)
    staff = tuple(
        replace(
            member, last_sign_in_at=last_sign_in(activity, member, member.last_sign_in_at, None)
        )
        for member in _staff(demo_date)
    )
    return DemoDataset(
        demo_date=demo_date,
        catalog_etag=catalog_etag(),
        doctors=doctors,
        bookings=tuple(bookings),
        leave=frozenset(leave),
        holidays=holidays,
        staff=staff,
        activity=activity,
    )


@lru_cache(maxsize=2)
def _cached(demo_date: date, etag: str) -> DemoDataset:
    return build_dataset(demo_date)


def get_dataset(demo_date: date) -> DemoDataset:
    return _cached(demo_date, catalog_etag())
