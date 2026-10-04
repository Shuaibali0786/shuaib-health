"""Load the sample catalog into the database.

``catalog.json`` is exported from the frontend mock files (frontend/scripts/export-catalog.mjs);
``extras.json`` holds sample values the mocks do not have (clinic rules, logo, brand colours,
slot length). The seed is idempotent: records are upserted by natural key in one transaction,
existing UUIDs are kept, child and link rows of seeded parents are replaced, and rows that are
not part of the seed are never touched. Mock IDs (``dept-cardiology``) only resolve references
in memory; they are never stored.
"""

import json
import uuid
from collections import defaultdict
from collections.abc import Iterable, Mapping, Sequence
from dataclasses import dataclass, field
from datetime import UTC, date, datetime, time, timedelta
from itertools import pairwise
from pathlib import Path
from typing import Any, Literal
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel
from sqlalchemy import Connection, Engine, Table, delete, func, insert, select
from sqlalchemy.dialects.postgresql import insert as pg_insert

from app.models import (
    ClinicHoliday,
    ClinicRule,
    ClinicSettings,
    Department,
    DepartmentRelatedTest,
    Doctor,
    DoctorLeave,
    DoctorWeeklySchedule,
    HealthPackage,
    HealthPackageTest,
    LabTest,
    LabTestCategory,
    LabTestRelatedDepartment,
)

DATA_DIR = Path(__file__).resolve().parent / "data"
IMAGE_PREFIX = "/images/"
HHMM = r"^([01][0-9]|2[0-3]):[0-5][0-9]$"
SLUG = r"^[a-z0-9]+(-[a-z0-9]+)*$"
ALLOWED_LANGUAGES = {"Urdu", "English", "Sindhi", "Punjabi"}
WEEKDAYS = ("mon", "tue", "wed", "thu", "fri", "sat", "sun")
MAX_DAY_OFFSET = 13  # the default 14-day booking window

Weekday = Literal["mon", "tue", "wed", "thu", "fri", "sat", "sun"]


class SeedError(ValueError):
    """The seed files are inconsistent. The message names the record."""


class _In(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, extra="forbid")


class PhoneIn(_In):
    display: str
    tel: str = Field(pattern=r"^\+[1-9][0-9]{6,14}$")


class OpeningHoursIn(_In):
    days: list[Weekday]
    opens: str = Field(pattern=HHMM)
    closes: str = Field(pattern=HHMM)


class MapAreaIn(_In):
    bbox: tuple[float, float, float, float]
    label: str


class CreditIn(_In):
    text: str
    href: str = Field(pattern=r"^https://")


class ImageIn(_In):
    src: str
    alt: str
    width: int = Field(gt=0)
    height: int = Field(gt=0)


class SiteConfigIn(_In):
    name: str
    tagline: str
    full_title: str
    demo_notice: str
    emergency_phone: PhoneIn
    general_phone: PhoneIn
    address: list[str]
    time_zone: str
    opening_hours: list[OpeningHoursIn]
    lab_hours: list[OpeningHoursIn]
    map_area: MapAreaIn
    credit: CreditIn
    indexable: bool
    is_sample: bool


class DepartmentIn(_In):
    id: str
    slug: str = Field(pattern=SLUG, max_length=80)
    name: str
    summary: str
    image: ImageIn
    sort_order: int
    overview: str
    conditions: list[str]
    services: list[str]
    related_test_slugs: list[str]
    is_sample: bool


class SessionIn(_In):
    day: Weekday
    start: time
    end: time


class DoctorIn(_In):
    id: str
    slug: str = Field(pattern=SLUG, max_length=80)
    full_name: str
    department_id: str
    specialty: str
    photo: ImageIn
    fee_pkr: int = Field(ge=0)
    qualifications: list[str]
    experience_years: int = Field(ge=0, le=70)
    languages: list[str]
    bio: str
    schedule: list[SessionIn]
    is_featured: bool
    is_sample: bool


class CategoryIn(_In):
    id: str
    slug: str = Field(pattern=SLUG, max_length=80)
    name: str
    icon_name: str


class LabTestIn(_In):
    id: str
    slug: str = Field(pattern=SLUG, max_length=80)
    name: str
    also_known_as: list[str]
    category_id: str
    price_pkr: int = Field(ge=0)
    sample_type: str
    report_time: str
    preparation: str
    home_collection: bool
    about: str
    related_department_ids: list[str]
    is_sample: bool


class PackageIn(_In):
    id: str
    slug: str = Field(pattern=SLUG, max_length=80)
    name: str
    icon_name: str
    who_for: str
    test_slugs: list[str]
    package_price_pkr: int = Field(ge=0)
    preparation: str
    home_collection: bool
    is_sample: bool


class CatalogIn(_In):
    site_config: SiteConfigIn
    departments: list[DepartmentIn]
    doctors: list[DoctorIn]
    lab_test_categories: list[CategoryIn]
    lab_tests: list[LabTestIn]
    health_packages: list[PackageIn]


class RuleIn(_In):
    sort_order: int = Field(ge=1)
    text: str = Field(min_length=1, max_length=300)


class LogoIn(_In):
    key: str
    alt: str
    width: int = Field(gt=0)
    height: int = Field(gt=0)


class BrandColorsIn(_In):
    primary: str = Field(pattern=r"^#[0-9A-Fa-f]{6}$")
    accent: str = Field(pattern=r"^#[0-9A-Fa-f]{6}$")


class ExtrasIn(_In):
    clinic_rules: list[RuleIn]
    logo: LogoIn
    brand_colors: BrandColorsIn
    default_slot_minutes: int = Field(ge=5, le=120)


class LeaveIn(_In):
    """A sample day off. With ``start`` and ``end`` it is a partial day, otherwise the whole day."""

    doctor_slug: str
    day_offset: int
    start: time | None = None
    end: time | None = None


class HolidayIn(_In):
    day_offset: int
    name: str = Field(min_length=1, max_length=80)


class BookingSeedIn(_In):
    leave: list[LeaveIn] = Field(default_factory=list)
    holidays: list[HolidayIn] = Field(default_factory=list)


@dataclass(frozen=True)
class SeedData:
    catalog: CatalogIn
    extras: ExtrasIn
    booking: BookingSeedIn = field(default_factory=BookingSeedIn)


@dataclass
class SeedReport:
    counts: dict[str, int] = field(default_factory=dict)


def load_seed_files(data_dir: Path = DATA_DIR) -> SeedData:
    catalog = json.loads((data_dir / "catalog.json").read_text(encoding="utf-8"))
    extras = json.loads((data_dir / "extras.json").read_text(encoding="utf-8"))
    booking_file = data_dir / "booking.json"
    booking = (
        BookingSeedIn.model_validate(json.loads(booking_file.read_text(encoding="utf-8")))
        if booking_file.exists()
        else BookingSeedIn()
    )
    return SeedData(CatalogIn.model_validate(catalog), ExtrasIn.model_validate(extras), booking)


def image_key(src: str, owner: str) -> str:
    if not src.startswith(IMAGE_PREFIX):
        raise SeedError(f"{owner}: image src must start with {IMAGE_PREFIX}")
    return src[len(IMAGE_PREFIX) :]


def _unique(values: Iterable[str], what: str) -> None:
    seen: set[str] = set()
    for value in values:
        if value in seen:
            raise SeedError(f"duplicate {what}: {value}")
        seen.add(value)


def validate_seed(data: SeedData) -> None:
    """Check references and invariants the database cannot express. Raises ``SeedError``."""
    c = data.catalog
    try:
        ZoneInfo(c.site_config.time_zone)
    except (ZoneInfoNotFoundError, ValueError) as exc:
        raise SeedError("siteConfig: timeZone is not a valid IANA time zone") from exc

    for items, what in (
        (c.departments, "department"),
        (c.doctors, "doctor"),
        (c.lab_test_categories, "lab test category"),
        (c.lab_tests, "lab test"),
        (c.health_packages, "health package"),
    ):
        _unique((item.slug for item in items), f"{what} slug")
        _unique((item.id for item in items), f"{what} id")
    _unique((str(rule.sort_order) for rule in data.extras.clinic_rules), "clinic rule sortOrder")

    department_ids = {d.id for d in c.departments}
    category_ids = {cat.id for cat in c.lab_test_categories}
    tests_by_slug = {t.slug: t for t in c.lab_tests}

    for dept in c.departments:
        image_key(dept.image.src, dept.slug)
        for slug in dept.related_test_slugs:
            if slug not in tests_by_slug:
                raise SeedError(f"{dept.slug}: related test {slug} does not exist")

    for doc in c.doctors:
        image_key(doc.photo.src, doc.slug)
        if doc.department_id not in department_ids:
            raise SeedError(f"{doc.slug}: department {doc.department_id} does not exist")
        unknown = set(doc.languages) - ALLOWED_LANGUAGES
        if unknown:
            raise SeedError(f"{doc.slug}: unsupported language(s) {sorted(unknown)}")
        by_day: dict[str, list[SessionIn]] = defaultdict(list)
        for session in doc.schedule:
            if session.start >= session.end:
                raise SeedError(f"{doc.slug}: session on {session.day} ends before it starts")
            by_day[session.day].append(session)
        for day, sessions in by_day.items():
            ordered = sorted(sessions, key=lambda s: s.start)
            for earlier, later in pairwise(ordered):
                if later.start < earlier.end:
                    raise SeedError(f"{doc.slug}: overlapping sessions on {day}")

    doctor_slugs = {d.slug for d in c.doctors}
    for index, leave in enumerate(data.booking.leave, start=1):
        record = f"booking leave #{index} ({leave.doctor_slug})"
        if leave.doctor_slug not in doctor_slugs:
            raise SeedError(f"{record}: doctor {leave.doctor_slug} does not exist")
        if not 0 <= leave.day_offset <= MAX_DAY_OFFSET:
            raise SeedError(f"{record}: dayOffset must be 0 to {MAX_DAY_OFFSET}")
        if (leave.start is None) != (leave.end is None):
            raise SeedError(f"{record}: give both start and end, or neither")
        if leave.start is not None and leave.end is not None and leave.start >= leave.end:
            raise SeedError(f"{record}: end must be after start")
    for index, holiday in enumerate(data.booking.holidays, start=1):
        if not 0 <= holiday.day_offset <= MAX_DAY_OFFSET:
            raise SeedError(
                f"booking holiday #{index} ({holiday.name}): dayOffset must be 0-{MAX_DAY_OFFSET}"
            )

    for test in c.lab_tests:
        if test.category_id not in category_ids:
            raise SeedError(f"{test.slug}: category {test.category_id} does not exist")
        for dept_id in test.related_department_ids:
            if dept_id not in department_ids:
                raise SeedError(f"{test.slug}: related department {dept_id} does not exist")

    for pkg in c.health_packages:
        _unique(pkg.test_slugs, f"{pkg.slug} test slug")
        missing = [slug for slug in pkg.test_slugs if slug not in tests_by_slug]
        if missing:
            raise SeedError(f"{pkg.slug}: included test(s) {missing} do not exist")
        total = sum(tests_by_slug[slug].price_pkr for slug in pkg.test_slugs)
        if pkg.package_price_pkr > total:
            raise SeedError(f"{pkg.slug}: package price is above the sum of its tests")


def _table(model: type[Any]) -> Table:
    table: Table = model.__table__
    return table


def _upsert(
    conn: Connection, model: type[Any], rows: Sequence[Mapping[str, Any]], key: str
) -> dict[Any, uuid.UUID]:
    """Insert or update ``rows`` matched on ``key``; return ``{key value: id}``."""
    if not rows:
        return {}
    table = _table(model)
    insert_stmt = pg_insert(table).values(list(rows))
    updatable = set(rows[0]) - {key}
    upsert = insert_stmt.on_conflict_do_update(
        index_elements=[table.c[key]],
        set_={
            **{name: insert_stmt.excluded[name] for name in updatable},
            "updated_at": func.now(),
        },
    ).returning(table.c[key], table.c.id)
    return {row[0]: row[1] for row in conn.execute(upsert)}


def _replace_children(
    conn: Connection,
    model: type[Any],
    parent_column: str,
    parent_ids: Iterable[uuid.UUID],
    rows: Sequence[Mapping[str, Any]],
) -> None:
    table = _table(model)
    conn.execute(delete(table).where(table.c[parent_column].in_(list(parent_ids))))
    if rows:
        conn.execute(insert(table), list(rows))


def _local_day_to_utc(
    day: date, start: time | None, end: time | None, tz: ZoneInfo
) -> tuple[datetime, datetime]:
    """UTC range of a clinic-local day (midnight to midnight) or of a time range inside it."""
    if start is None or end is None:
        first = datetime.combine(day, time.min, tzinfo=tz)
        last = datetime.combine(day + timedelta(days=1), time.min, tzinfo=tz)
    else:
        first = datetime.combine(day, start, tzinfo=tz)
        last = datetime.combine(day, end, tzinfo=tz)
    return first.astimezone(UTC), last.astimezone(UTC)


def _working_day(today: date, offset: int, working: set[int]) -> date:
    """The offset day, moved to the doctor's next working weekday inside the window.

    If none is left before the end of the window, the nearest earlier working day is used.
    """
    for candidate in range(offset, MAX_DAY_OFFSET + 1):
        if (today + timedelta(days=candidate)).weekday() in working:
            return today + timedelta(days=candidate)
    for candidate in range(offset - 1, -1, -1):
        if (today + timedelta(days=candidate)).weekday() in working:
            return today + timedelta(days=candidate)
    return today + timedelta(days=offset)


def _write_booking(
    conn: Connection,
    data: SeedData,
    doctor_ids: Mapping[str, uuid.UUID],
    now: datetime,
    report: SeedReport,
) -> None:
    """Replace the sample leave and holidays. Offsets count from the seed run's clinic-local day."""
    tz = ZoneInfo(data.catalog.site_config.time_zone)
    today = now.astimezone(tz).date()
    sessions_by_doctor = {
        d.slug: {WEEKDAYS.index(s.day) for s in d.schedule} for d in data.catalog.doctors
    }

    leave_rows = []
    for leave in data.booking.leave:
        day = _working_day(today, leave.day_offset, sessions_by_doctor[leave.doctor_slug])
        starts_at, ends_at = _local_day_to_utc(day, leave.start, leave.end, tz)
        leave_rows.append(
            {
                "doctor_id": doctor_ids[leave.doctor_slug],
                "starts_at": starts_at,
                "ends_at": ends_at,
                "note": "Sample leave (seed)",
                "is_sample": True,
            }
        )
    holiday_rows = [
        {
            "holiday_date": today + timedelta(days=h.day_offset),
            "name": h.name,
            "is_sample": True,
        }
        for h in data.booking.holidays
    ]

    leave_table, holiday_table = _table(DoctorLeave), _table(ClinicHoliday)
    conn.execute(delete(leave_table).where(leave_table.c.is_sample.is_(True)))
    conn.execute(delete(holiday_table).where(holiday_table.c.is_sample.is_(True)))
    if leave_rows:
        conn.execute(insert(leave_table), leave_rows)
    if holiday_rows:
        # A holiday the clinic added itself on the same date wins.
        conn.execute(pg_insert(holiday_table).values(holiday_rows).on_conflict_do_nothing())
    report.counts["doctor_leave"] = conn.execute(
        select(func.count()).select_from(leave_table).where(leave_table.c.is_sample.is_(True))
    ).scalar_one()
    report.counts["clinic_holiday"] = conn.execute(
        select(func.count()).select_from(holiday_table).where(holiday_table.c.is_sample.is_(True))
    ).scalar_one()


def _write(conn: Connection, data: SeedData, now: datetime) -> SeedReport:
    c, extras = data.catalog, data.extras
    site = c.site_config
    report = SeedReport()

    settings_row = {
        "singleton": True,
        "name": site.name,
        "tagline": site.tagline,
        "full_title": site.full_title,
        "demo_notice": site.demo_notice,
        "emergency_phone": site.emergency_phone.model_dump(),
        "general_phone": site.general_phone.model_dump(),
        "address": site.address,
        "time_zone": site.time_zone,
        "opening_hours": [rule.model_dump() for rule in site.opening_hours],
        "lab_hours": [rule.model_dump() for rule in site.lab_hours],
        "map_area": {"bbox": list(site.map_area.bbox), "label": site.map_area.label},
        "credit": site.credit.model_dump(),
        "logo": extras.logo.model_dump(),
        "brand_colors": extras.brand_colors.model_dump(),
        "indexable": site.indexable,
        "is_sample": site.is_sample,
    }
    report.counts["clinic_settings"] = len(
        _upsert(conn, ClinicSettings, [settings_row], "singleton")
    )

    rule_rows = [
        {"sort_order": r.sort_order, "text": r.text, "is_active": True, "is_sample": True}
        for r in extras.clinic_rules
    ]
    report.counts["clinic_rule"] = len(_upsert(conn, ClinicRule, rule_rows, "sort_order"))

    category_ids = _upsert(
        conn,
        LabTestCategory,
        [
            {"slug": cat.slug, "name": cat.name, "icon_name": cat.icon_name, "sort_order": i}
            for i, cat in enumerate(c.lab_test_categories, start=1)
        ],
        "slug",
    )
    category_by_mock = {cat.id: category_ids[cat.slug] for cat in c.lab_test_categories}
    report.counts["lab_test_category"] = len(category_ids)

    department_ids = _upsert(
        conn,
        Department,
        [
            {
                "slug": d.slug,
                "name": d.name,
                "summary": d.summary,
                "image_key": image_key(d.image.src, d.slug),
                "image_alt": d.image.alt,
                "image_width": d.image.width,
                "image_height": d.image.height,
                "sort_order": d.sort_order,
                "overview": d.overview,
                "conditions": d.conditions,
                "services": d.services,
                "is_active": True,
                "is_sample": True,
            }
            for d in c.departments
        ],
        "slug",
    )
    department_by_mock = {d.id: department_ids[d.slug] for d in c.departments}
    report.counts["department"] = len(department_ids)

    test_ids = _upsert(
        conn,
        LabTest,
        [
            {
                "slug": t.slug,
                "name": t.name,
                "also_known_as": t.also_known_as,
                "category_id": category_by_mock[t.category_id],
                "price_pkr": t.price_pkr,
                "sample_type": t.sample_type,
                "report_time": t.report_time,
                "preparation": t.preparation,
                "home_collection": t.home_collection,
                "about": t.about,
                "sort_order": i,
                "is_active": True,
                "is_sample": True,
            }
            for i, t in enumerate(c.lab_tests, start=1)
        ],
        "slug",
    )
    report.counts["lab_test"] = len(test_ids)

    doctor_ids = _upsert(
        conn,
        Doctor,
        [
            {
                "slug": d.slug,
                "full_name": d.full_name,
                "department_id": department_by_mock[d.department_id],
                "specialty": d.specialty,
                "photo_key": image_key(d.photo.src, d.slug),
                "photo_alt": d.photo.alt,
                "photo_width": d.photo.width,
                "photo_height": d.photo.height,
                "fee_pkr": d.fee_pkr,
                "qualifications": d.qualifications,
                "experience_years": d.experience_years,
                "languages": d.languages,
                "bio": d.bio,
                "sort_order": i,
                "is_featured": d.is_featured,
                "is_active": True,
                "is_sample": True,
            }
            for i, d in enumerate(c.doctors, start=1)
        ],
        "slug",
    )
    report.counts["doctor"] = len(doctor_ids)

    schedule_rows = [
        {
            "doctor_id": doctor_ids[d.slug],
            "weekday": s.day,
            "start_time": s.start,
            "end_time": s.end,
            "slot_minutes": extras.default_slot_minutes,
        }
        for d in c.doctors
        for s in d.schedule
    ]
    _replace_children(conn, DoctorWeeklySchedule, "doctor_id", doctor_ids.values(), schedule_rows)
    report.counts["doctor_weekly_schedule"] = len(schedule_rows)

    package_ids = _upsert(
        conn,
        HealthPackage,
        [
            {
                "slug": p.slug,
                "name": p.name,
                "icon_name": p.icon_name,
                "who_for": p.who_for,
                "package_price_pkr": p.package_price_pkr,
                "preparation": p.preparation,
                "home_collection": p.home_collection,
                "sort_order": i,
                "is_active": True,
                "is_sample": True,
            }
            for i, p in enumerate(c.health_packages, start=1)
        ],
        "slug",
    )
    report.counts["health_package"] = len(package_ids)

    dept_test_rows = [
        {"department_id": department_ids[d.slug], "lab_test_id": test_ids[slug], "sort_order": i}
        for d in c.departments
        for i, slug in enumerate(d.related_test_slugs, start=1)
    ]
    _replace_children(
        conn, DepartmentRelatedTest, "department_id", department_ids.values(), dept_test_rows
    )
    report.counts["department_related_test"] = len(dept_test_rows)

    test_dept_rows = [
        {
            "lab_test_id": test_ids[t.slug],
            "department_id": department_by_mock[mock],
            "sort_order": i,
        }
        for t in c.lab_tests
        for i, mock in enumerate(t.related_department_ids, start=1)
    ]
    _replace_children(
        conn, LabTestRelatedDepartment, "lab_test_id", test_ids.values(), test_dept_rows
    )
    report.counts["lab_test_related_department"] = len(test_dept_rows)

    package_test_rows = [
        {"package_id": package_ids[p.slug], "lab_test_id": test_ids[slug], "sort_order": i}
        for p in c.health_packages
        for i, slug in enumerate(p.test_slugs, start=1)
    ]
    _replace_children(
        conn, HealthPackageTest, "package_id", package_ids.values(), package_test_rows
    )
    report.counts["health_package_test"] = len(package_test_rows)

    _write_booking(conn, data, doctor_ids, now, report)
    return report


def seed_connection(
    conn: Connection, data: SeedData | None = None, now: datetime | None = None
) -> SeedReport:
    """Seed using an existing connection; the caller owns the transaction.

    ``now`` is the seed run clock (aware); sample leave and holidays are placed relative to it.
    """
    data = data or load_seed_files()
    validate_seed(data)
    return _write(conn, data, now or datetime.now(UTC))


def run_seed(
    engine: Engine, data: SeedData | None = None, now: datetime | None = None
) -> SeedReport:
    """Validate and load the seed data in a single transaction."""
    with engine.begin() as conn:
        return seed_connection(conn, data, now)
