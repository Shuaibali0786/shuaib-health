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
    WeekdayQuery,
)
from app.repositories import doctors as repo
from app.repositories._common import require_id
from app.schemas import image_asset

router = APIRouter(tags=["doctors"])


def to_schema(row: m.Doctor, sessions: list[repo.SessionDict], image_base: str) -> schemas.Doctor:
    schedule = [
        schemas.ScheduleSession.model_validate(
            {
                "day": s["weekday"],  # constrained to the seven weekdays by the database
                "start": s["start"],
                "end": s["end"],
                "slotMinutes": s["slotMinutes"],
            }
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
    items = [to_schema(row, sessions, settings.image_base_path) for row, sessions in rows]
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
    found = repo.get_doctor(session, slug)
    if found is None:
        raise NotFound("Doctor")
    row, sessions = found
    return respond(
        request, to_schema(row, sessions, settings.image_base_path), settings.cache_max_age_seconds
    )
