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
from dataclasses import dataclass, field
from datetime import UTC, date, datetime, time, timedelta
from functools import cache, lru_cache
from pathlib import Path
from typing import Any, Final, Literal
from zoneinfo import ZoneInfo

from app.demo import names

SEED_DATA = Path(__file__).resolve().parent.parent / "seed" / "data"
SEED_PREFIX = "shuaib-health-demo:v1:"
CROCKFORD: Final = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"
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
        digest.update((SEED_DATA / name).read_bytes())
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
    is_sample: bool = True

    @property
    def ends_at(self) -> datetime:
        return self.starts_at + timedelta(minutes=SLOT_MINUTES)

    def status_at(self, now: datetime) -> Status:
        """Cancelled stays cancelled; otherwise the booking moves with the clock."""
        if self.outcome == "cancelled":
            return "cancelled"
        if self.ends_at <= now:
            return self.outcome
        if self.starts_at <= now:
            return "arrived"
        return "confirmed"


@dataclass(frozen=True, slots=True)
class DemoStaff:
    id: uuid.UUID
    display_name: str
    role: Literal["admin", "receptionist"]
    email: str


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


def _reference(rnd: random.Random, taken: set[str]) -> str:
    while True:
        ref = "D" + "".join(CROCKFORD[int(rnd.random() * 32)] for _ in range(9))
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


def _staff() -> tuple[DemoStaff, ...]:
    return tuple(
        DemoStaff(uuid.uuid5(uuid.NAMESPACE_URL, f"{SEED_PREFIX}staff:{email}"), name, role, email)  # type: ignore[arg-type]
        for name, role, email in names.STAFF
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
                out.append(
                    DemoBooking(
                        reference=_reference(rnd, taken),
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
                        phone=f"+92300000{int(rnd.random() * 10000):04d}",
                        email=f"{contact.lower()}{int(rnd.random() * 90) + 10}@example.com",
                        reason=_pick(rnd, names.REASONS[doctor.department]),
                        fee_pkr=doctor.fee_pkr,
                        created_at=created_at,
                    )
                )
    return out


def _activity(
    rnd: random.Random, today: date, staff: tuple[DemoStaff, ...], bookings: list[DemoBooking]
) -> tuple[DemoActivity, ...]:
    by_day: dict[date, list[DemoBooking]] = {}
    for booking in bookings:
        by_day.setdefault(booking.starts_at.astimezone(CLINIC_ZONE).date(), []).append(booking)
    events: list[DemoActivity] = []
    for back in range(7):
        day = today - timedelta(days=back)
        pool = [b for b in by_day.get(day, []) if b.outcome != "cancelled"]
        last_hour = 10 if back == 0 else 19  # today's feed stops before a typical "now"
        for _ in range(14 if pool else 0):
            who = _pick(rnd, staff)
            at = _local_midnight(day) + timedelta(
                minutes=8 * 60 + int(rnd.random() * (last_hour - 8) * 60)
            )
            roll = rnd.random()
            tag = hashlib.sha256(f"{who.email}:{day}".encode()).hexdigest()[:6]
            if roll < 0.2:
                events.append(
                    DemoActivity(at, who.display_name, who.role, "auth.sign_in", network_tag=tag)
                )
                continue
            target = _pick(rnd, tuple(pool))
            if roll < 0.5:
                events.append(
                    DemoActivity(
                        at,
                        who.display_name,
                        who.role,
                        "booking.phone_revealed",
                        target.reference,
                        network_tag=tag,
                    )
                )
            else:
                before: Status = "confirmed"
                after: Status = "arrived" if roll < 0.8 else target.outcome
                events.append(
                    DemoActivity(
                        at,
                        who.display_name,
                        who.role,
                        "booking.status_changed",
                        target.reference,
                        before,
                        after,
                        tag,
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
    staff = _staff()
    return DemoDataset(
        demo_date=demo_date,
        catalog_etag=catalog_etag(),
        doctors=doctors,
        bookings=tuple(bookings),
        leave=frozenset(leave),
        holidays=holidays,
        staff=staff,
        activity=_activity(rnd, demo_date, staff, bookings),
    )


@lru_cache(maxsize=2)
def _cached(demo_date: date, etag: str) -> DemoDataset:
    return build_dataset(demo_date)


def get_dataset(demo_date: date) -> DemoDataset:
    return _cached(demo_date, catalog_etag())
