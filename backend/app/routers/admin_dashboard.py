"""Read screens of the Command Centre that are not bookings: filter lookups, the Overview, Insights,
Doctors today and Activity."""

import uuid
from typing import Annotated, Any

from fastapi import APIRouter, Depends, Query, Response
from pydantic import BeforeValidator

from app.auth.audit import AuthAction
from app.auth.deps import Viewer, get_source, require_viewer, viewer_now
from app.auth.policies import Policy
from app.booking.clock import ClockDep
from app.command_centre.schemas import (
    ActivityPage,
    DoctorsToday,
    Insights,
    InsightsRange,
    Lookups,
    Overview,
)
from app.db import SessionDep
from app.deps import ADMIN_ERRORS_DOC, SettingsDep
from app.routers.admin_bookings import clinic_zone
from app.schemas import ErrorResponse


def _whole_number(value: Any) -> Any:
    """Query values arrive as text: \"30\" is the range 30; the Literal refuses anything else."""
    return int(value) if isinstance(value, str) and value.strip().isdigit() else value


PARAM_ERRORS: dict[int | str, dict[str, object]] = {
    **ADMIN_ERRORS_DOC,
    422: {"model": ErrorResponse},
}

router = APIRouter(prefix="/admin", tags=["command-centre"])


@router.get(
    "/lookups",
    response_model=Lookups,
    response_model_exclude_none=True,
    responses=ADMIN_ERRORS_DOC,
    operation_id="adminLookups",
    summary="Doctors and departments for the filters",
)
def lookups(
    viewer: Annotated[Viewer, Depends(require_viewer(Policy.READ))],
    db: SessionDep,
    response: Response,
) -> Lookups:
    response.headers["Cache-Control"] = "no-store"
    return get_source(viewer, db).lookups()


@router.get(
    "/overview",
    response_model=Overview,
    responses=ADMIN_ERRORS_DOC,
    operation_id="adminOverview",
    summary="Today at a glance",
)
def overview(
    viewer: Annotated[Viewer, Depends(require_viewer(Policy.READ))],
    db: SessionDep,
    clock: ClockDep,
    settings: SettingsDep,
    response: Response,
) -> Overview:
    response.headers["Cache-Control"] = "no-store"
    now = viewer_now(viewer, settings, clock.now())
    return get_source(viewer, db).overview(clinic_zone(viewer, db), now)


@router.get(
    "/insights",
    response_model=Insights,
    response_model_by_alias=True,
    responses=PARAM_ERRORS,
    operation_id="adminInsights",
    summary="Charts for the last 7, 30 or 90 days",
)
def insights(
    viewer: Annotated[Viewer, Depends(require_viewer(Policy.READ))],
    db: SessionDep,
    clock: ClockDep,
    settings: SettingsDep,
    response: Response,
    range_days: Annotated[InsightsRange, BeforeValidator(_whole_number), Query(alias="range")],
) -> Insights:
    response.headers["Cache-Control"] = "no-store"
    now = viewer_now(viewer, settings, clock.now())
    return get_source(viewer, db).insights(range_days, clinic_zone(viewer, db), now)


@router.get(
    "/doctors-today",
    response_model=DoctorsToday,
    responses=ADMIN_ERRORS_DOC,
    operation_id="adminDoctorsToday",
    summary="Who is in today, with booked and free slots",
)
def doctors_today(
    viewer: Annotated[Viewer, Depends(require_viewer(Policy.READ))],
    db: SessionDep,
    clock: ClockDep,
    settings: SettingsDep,
    response: Response,
) -> DoctorsToday:
    response.headers["Cache-Control"] = "no-store"
    now = viewer_now(viewer, settings, clock.now())
    return get_source(viewer, db).doctors_today(clinic_zone(viewer, db), now)


@router.get(
    "/activity",
    response_model=ActivityPage,
    response_model_exclude_none=True,
    responses=PARAM_ERRORS,
    operation_id="adminActivity",
    summary="Security and operational events, newest first (admins only)",
)
def activity(
    viewer: Annotated[Viewer, Depends(require_viewer(Policy.READ_ADMIN))],
    db: SessionDep,
    clock: ClockDep,
    settings: SettingsDep,
    response: Response,
    action: Annotated[AuthAction | None, Query()] = None,
    staff_id: Annotated[uuid.UUID | None, Query(alias="staffId")] = None,
    page: Annotated[int, Query(ge=1, le=10_000)] = 1,
) -> ActivityPage:
    response.headers["Cache-Control"] = "no-store"
    now = viewer_now(viewer, settings, clock.now())
    return get_source(viewer, db).activity(action=action, staff_id=staff_id, page=page, now=now)
