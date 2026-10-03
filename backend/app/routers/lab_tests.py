from uuid import UUID

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
)
from app.repositories import lab_tests as repo
from app.repositories._common import require_id

router = APIRouter(tags=["lab tests"])


def to_schema(row: m.LabTest, department_ids: list[UUID]) -> schemas.LabTest:
    return schemas.LabTest(
        id=require_id(row.id),
        slug=row.slug,
        name=row.name,
        also_known_as=row.also_known_as,
        category_id=row.category_id,
        price_pkr=row.price_pkr,
        sample_type=row.sample_type,
        report_time=row.report_time,
        preparation=row.preparation,
        home_collection=row.home_collection,
        about=row.about,
        related_department_ids=department_ids,
        is_sample=row.is_sample,
    )


@router.get(
    "/lab-test-categories",
    response_model=schemas.Page[schemas.LabTestCategory],
    responses=LIST_ERRORS,
    summary="List lab test categories",
)
def list_categories(
    request: Request,
    session: SessionDep,
    settings: SettingsDep,
    page: PageParam = DEFAULT_PAGE,
    page_size: PageSizeParam = DEFAULT_PAGE_SIZE,
) -> Response:
    rows, total = repo.list_categories(session, page, page_size)
    items = [
        schemas.LabTestCategory(
            id=require_id(r.id), slug=r.slug, name=r.name, icon_name=r.icon_name
        )
        for r in rows
    ]
    body = schemas.Page[schemas.LabTestCategory](
        items=items, total=total, page=page, page_size=page_size
    )
    return respond(request, body, settings.cache_max_age_seconds)


@router.get(
    "/lab-tests",
    response_model=schemas.Page[schemas.LabTest],
    responses=LIST_ERRORS,
    summary="List lab tests",
)
def list_lab_tests(
    request: Request,
    session: SessionDep,
    settings: SettingsDep,
    page: PageParam = DEFAULT_PAGE,
    page_size: PageSizeParam = DEFAULT_PAGE_SIZE,
    q: SearchParam = None,
    category: SlugQuery = None,
) -> Response:
    rows, total = repo.list_lab_tests(session, page, page_size, q, category)
    departments = repo.related_department_ids(session, [require_id(r.id) for r in rows])
    items = [to_schema(r, departments.get(require_id(r.id), [])) for r in rows]
    body = schemas.Page[schemas.LabTest](items=items, total=total, page=page, page_size=page_size)
    return respond(request, body, settings.cache_max_age_seconds)


@router.get(
    "/lab-tests/{slug}",
    response_model=schemas.LabTest,
    responses=DETAIL_ERRORS,
    summary="Lab test by slug",
)
def get_lab_test(
    request: Request, session: SessionDep, settings: SettingsDep, slug: SlugPath
) -> Response:
    row = repo.get_lab_test(session, slug)
    if row is None:
        raise NotFound("Lab test")
    departments = repo.related_department_ids(session, [require_id(row.id)])
    body = to_schema(row, departments.get(require_id(row.id), []))
    return respond(request, body, settings.cache_max_age_seconds)
