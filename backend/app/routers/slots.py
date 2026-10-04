"""Server-computed available slots for one doctor (Feature 005, US4)."""

from datetime import date
from typing import Annotated

from fastapi import APIRouter, Query, Response

from app import schemas
from app.booking.clock import ClockDep
from app.booking.slots import DayOut, SlotOut, build_days
from app.booking.timeutil import utc_iso
from app.db import SessionDep
from app.deps import DETAIL_ERRORS
from app.errors import ClinicNotConfigured, NotFound
from app.params import SlugPath
from app.repositories import availability as repo

router = APIRouter(tags=["booking"])

FromParam = Annotated[date | None, Query(alias="from")]
DaysParam = Annotated[int | None, Query(ge=1, le=60)]


def slot_to_schema(slot: SlotOut) -> schemas.Slot:
    return schemas.Slot(
        starts_at=utc_iso(slot.starts_at), ends_at=utc_iso(slot.ends_at), local_time=slot.local_time
    )


def day_to_schema(day: DayOut) -> schemas.SlotDay:
    return schemas.SlotDay(
        date=day.date.isoformat(),
        weekday=day.weekday,
        status=day.status,
        holiday_name=day.holiday_name,
        slots=[slot_to_schema(s) for s in day.slots],
    )


@router.get(
    "/doctors/{slug}/slots",
    response_model=schemas.DoctorSlots,
    response_model_exclude_none=True,
    responses=DETAIL_ERRORS | {503: {"model": schemas.ErrorResponse}},
    summary="Available slots for one doctor within the booking window",
)
def get_doctor_slots(
    slug: SlugPath,
    session: SessionDep,
    clock: ClockDep,
    response: Response,
    from_: FromParam = None,
    days: DaysParam = None,
) -> schemas.DoctorSlots:
    context = repo.load_booking_context(session, slug)
    if context is None:
        raise ClinicNotConfigured
    doctor, settings = context.doctor, context.settings
    if doctor is None:
        raise NotFound("Doctor")
    now = clock.now()
    data = repo.load_availability(session, doctor.id, settings, now)
    computed = build_days(
        now=now,
        tz=settings.time_zone,
        window_days=settings.window_days,
        lead_minutes=settings.lead_minutes,
        sessions=context.sessions,
        leave=data.leave,
        holidays=data.holidays,
        bookings=data.bookings,
        from_date=from_,
        days=days,
    )
    response.headers["Cache-Control"] = "no-store"
    return schemas.DoctorSlots(
        doctor_slug=doctor.slug,
        time_zone=settings.time_zone.key,
        window_days=settings.window_days,
        generated_at=utc_iso(now),
        days=[day_to_schema(d) for d in computed],
    )
