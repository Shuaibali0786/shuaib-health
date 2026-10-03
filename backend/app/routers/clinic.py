import logging

from fastapi import APIRouter, Request, Response
from pydantic import ValidationError

from app import models as m
from app import schemas
from app.db import SessionDep
from app.deps import LIST_ERRORS, SettingsDep
from app.errors import ClinicNotConfigured, StoredDataInvalid
from app.http_cache import respond
from app.params import DEFAULT_PAGE, DEFAULT_PAGE_SIZE, PageParam, PageSizeParam
from app.repositories import clinic as repo
from app.repositories._common import require_id
from app.schemas import ErrorResponse, image_asset

logger = logging.getLogger("app.clinic")
router = APIRouter(tags=["clinic"])


def to_schema(row: m.ClinicSettings, image_base: str) -> schemas.ClinicSettings:
    """Validate the stored JSON values; never echo them if they are malformed."""
    try:
        logo = schemas.StoredLogo.model_validate(row.logo)
        return schemas.ClinicSettings(
            name=row.name,
            tagline=row.tagline,
            full_title=row.full_title,
            demo_notice=row.demo_notice,
            emergency_phone=schemas.PhoneNumber.model_validate(row.emergency_phone),
            general_phone=schemas.PhoneNumber.model_validate(row.general_phone),
            address=row.address,
            time_zone=row.time_zone,
            opening_hours=[schemas.OpeningHoursRule.model_validate(r) for r in row.opening_hours],
            lab_hours=[schemas.OpeningHoursRule.model_validate(r) for r in row.lab_hours],
            map_area=schemas.MapArea.model_validate(row.map_area),
            credit=schemas.Credit.model_validate(row.credit),
            indexable=row.indexable,
            is_sample=row.is_sample,
            logo=image_asset(logo.key, logo.alt, logo.width, logo.height, image_base),
            brand_colors=schemas.BrandColors.model_validate(row.brand_colors),
        )
    except ValidationError as exc:
        logger.error("stored clinic settings are invalid (%d errors)", exc.error_count())
        raise StoredDataInvalid from None


@router.get(
    "/clinic",
    response_model=schemas.ClinicSettings,
    responses={**LIST_ERRORS, 503: {"model": ErrorResponse}},
    summary="Clinic settings (white-label)",
)
def get_clinic(request: Request, session: SessionDep, settings: SettingsDep) -> Response:
    row = repo.get_clinic_settings(session)
    if row is None:
        raise ClinicNotConfigured
    return respond(
        request, to_schema(row, settings.image_base_path), settings.cache_max_age_seconds
    )


@router.get(
    "/clinic/rules",
    response_model=schemas.Page[schemas.ClinicRule],
    responses=LIST_ERRORS,
    summary="Active clinic rules in display order",
)
def list_rules(
    request: Request,
    session: SessionDep,
    settings: SettingsDep,
    page: PageParam = DEFAULT_PAGE,
    page_size: PageSizeParam = DEFAULT_PAGE_SIZE,
) -> Response:
    rows, total = repo.list_rules(session, page, page_size)
    items = [
        schemas.ClinicRule(
            id=require_id(r.id), sort_order=r.sort_order, text=r.text, is_sample=r.is_sample
        )
        for r in rows
    ]
    body = schemas.Page[schemas.ClinicRule](
        items=items, total=total, page=page, page_size=page_size
    )
    return respond(request, body, settings.cache_max_age_seconds)
