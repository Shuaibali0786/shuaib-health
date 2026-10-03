from datetime import time
from typing import cast

from fastapi import APIRouter, Request, Response

from app import models as m
from app import schemas
from app.db import SessionDep
from app.deps import DETAIL_ERRORS, LIST_ERRORS, SettingsDep
from app.errors import NotFound
from app.http_cache import respond
from app.params import (
    DEFAULT_PAGE,
    DEFAULT_PAGE_SIZE,
    PageParam,
    PageSizeParam,
    SearchParam,
    SlugPath,
    SlugQuery,
    Weekday,
    WeekdayQuery,
)
from app.repositories import doctors as repo
from app.repositories._common import require_id
from app.schemas import image_asset

router = APIRouter(tags=["doctors"])


def _hhmm(value: time) -> str:
    return value.strftime("%H:%M")


def _weekday(value: str) -> Weekday:
    # The database CHECK constraint guarantees one of the seven values.
    return cast(Weekday, value)


def to_schema(
    row: m.Doctor, sessions: list[m.DoctorWeeklySchedule], image_base: str
) -> schemas.Doctor:
    schedule = [
        schemas.ScheduleSession(
            day=_weekday(s.weekday),
            start=_hhmm(s.start_time),
            end=_hhmm(s.end_time),
            slot_minutes=s.slot_minutes,
        )
        for s in sessions
    ]
    return schemas.Doctor(
        id=require_id(row.id),
        slug=row.slug,
        full_name=row.full_name,
        department_id=row.department_id,
        specialty=row.specialty,
        photo=image_asset(
            row.photo_key, row.photo_alt, row.photo_width, row.photo_height, image_base
        ),
        fee_pkr=row.fee_pkr,
        qualifications=row.qualifications,
        experience_years=row.experience_years,
        languages=row.languages,
        bio=row.bio,
        schedule=schedule,
        is_featured=row.is_featured,
        is_sample=row.is_sample,
    )


@router.get(
    "/doctors",
    response_model=schemas.Page[schemas.Doctor],
    responses=LIST_ERRORS,
    summary="List doctors",
)
def list_doctors(
    request: Request,
    session: SessionDep,
    settings: SettingsDep,
    page: PageParam = DEFAULT_PAGE,
    page_size: PageSizeParam = DEFAULT_PAGE_SIZE,
    department: SlugQuery = None,
    q: SearchParam = None,
    day: WeekdayQuery = None,
) -> Response:
    rows, total = repo.list_doctors(session, page, page_size, department, q, day)
    schedules = repo.schedules_for(session, [require_id(r.id) for r in rows])
    items = [
        to_schema(r, schedules.get(require_id(r.id), []), settings.image_base_path) for r in rows
    ]
    body = schemas.Page[schemas.Doctor](items=items, total=total, page=page, page_size=page_size)
    return respond(request, body, settings.cache_max_age_seconds)


@router.get(
    "/doctors/{slug}",
    response_model=schemas.Doctor,
    responses=DETAIL_ERRORS,
    summary="Doctor by slug, with weekly schedule",
)
def get_doctor(
    request: Request, session: SessionDep, settings: SettingsDep, slug: SlugPath
) -> Response:
    row = repo.get_doctor(session, slug)
    if row is None:
        raise NotFound("Doctor")
    schedules = repo.schedules_for(session, [require_id(row.id)])
    body = to_schema(row, schedules.get(require_id(row.id), []), settings.image_base_path)
    return respond(request, body, settings.cache_max_age_seconds)
