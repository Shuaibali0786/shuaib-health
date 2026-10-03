from fastapi import APIRouter, Request, Response

from app import models as m
from app import schemas
from app.db import SessionDep
from app.deps import DETAIL_ERRORS, LIST_ERRORS, SettingsDep
from app.errors import NotFound
from app.http_cache import respond
from app.params import DEFAULT_PAGE, DEFAULT_PAGE_SIZE, PageParam, PageSizeParam, SlugPath
from app.repositories import departments as repo
from app.repositories._common import require_id
from app.schemas import image_asset

router = APIRouter(tags=["departments"])


def to_schema(row: m.Department, test_slugs: list[str], image_base: str) -> schemas.Department:
    return schemas.Department(
        id=require_id(row.id),
        slug=row.slug,
        name=row.name,
        summary=row.summary,
        image=image_asset(
            row.image_key, row.image_alt, row.image_width, row.image_height, image_base
        ),
        sort_order=row.sort_order,
        overview=row.overview,
        conditions=row.conditions,
        services=row.services,
        related_test_slugs=test_slugs,
        is_sample=row.is_sample,
    )


@router.get(
    "/departments",
    response_model=schemas.Page[schemas.Department],
    responses=LIST_ERRORS,
    summary="List departments",
)
def list_departments(
    request: Request,
    session: SessionDep,
    settings: SettingsDep,
    page: PageParam = DEFAULT_PAGE,
    page_size: PageSizeParam = DEFAULT_PAGE_SIZE,
) -> Response:
    rows, total = repo.list_departments(session, page, page_size)
    items = [to_schema(row, slugs, settings.image_base_path) for row, slugs in rows]
    body = schemas.Page[schemas.Department](
        items=items, total=total, page=page, page_size=page_size
    )
    return respond(request, body, settings.cache_max_age_seconds)


@router.get(
    "/departments/{slug}",
    response_model=schemas.Department,
    responses=DETAIL_ERRORS,
    summary="Department by slug",
)
def get_department(
    request: Request, session: SessionDep, settings: SettingsDep, slug: SlugPath
) -> Response:
    found = repo.get_department(session, slug)
    if found is None:
        raise NotFound("Department")
    row, slugs = found
    return respond(
        request, to_schema(row, slugs, settings.image_base_path), settings.cache_max_age_seconds
    )
