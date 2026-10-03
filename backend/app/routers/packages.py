from fastapi import APIRouter, Request, Response

from app import models as m
from app import schemas
from app.db import SessionDep
from app.deps import DETAIL_ERRORS, LIST_ERRORS, SettingsDep
from app.errors import NotFound
from app.http_cache import respond
from app.params import DEFAULT_PAGE, DEFAULT_PAGE_SIZE, PageParam, PageSizeParam, SlugPath
from app.repositories import packages as repo
from app.repositories._common import require_id

router = APIRouter(tags=["health packages"])


def _summaries(tests: list[repo.TestSummary]) -> list[schemas.LabTestSummary]:
    return [schemas.LabTestSummary.model_validate(t) for t in tests]


def to_schema(row: m.HealthPackage, tests: list[repo.TestSummary]) -> schemas.HealthPackage:
    return schemas.HealthPackage(
        id=require_id(row.id),
        slug=row.slug,
        name=row.name,
        icon_name=row.icon_name,
        who_for=row.who_for,
        test_slugs=[t["slug"] for t in tests],
        package_price_pkr=row.package_price_pkr,
        preparation=row.preparation,
        home_collection=row.home_collection,
        is_sample=row.is_sample,
    )


@router.get(
    "/health-packages",
    response_model=schemas.Page[schemas.HealthPackage],
    responses=LIST_ERRORS,
    summary="List health packages",
)
def list_packages(
    request: Request,
    session: SessionDep,
    settings: SettingsDep,
    page: PageParam = DEFAULT_PAGE,
    page_size: PageSizeParam = DEFAULT_PAGE_SIZE,
) -> Response:
    rows, total = repo.list_packages(session, page, page_size)
    items = [to_schema(row, tests) for row, tests in rows]
    body = schemas.Page[schemas.HealthPackage](
        items=items, total=total, page=page, page_size=page_size
    )
    return respond(request, body, settings.cache_max_age_seconds)


@router.get(
    "/health-packages/{slug}",
    response_model=schemas.HealthPackageDetail,
    responses=DETAIL_ERRORS,
    summary="Health package by slug, with included tests",
)
def get_package(
    request: Request, session: SessionDep, settings: SettingsDep, slug: SlugPath
) -> Response:
    found = repo.get_package(session, slug)
    if found is None:
        raise NotFound("Health package")
    row, tests = found
    base = to_schema(row, tests)
    body = schemas.HealthPackageDetail(**base.model_dump(), tests=_summaries(tests))
    return respond(request, body, settings.cache_max_age_seconds)
