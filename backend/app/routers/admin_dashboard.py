"""Read screens of the Command Centre that are not bookings: filter lookups and the Overview;
insights, doctors today and activity are added by their own stories."""

from typing import Annotated

from fastapi import APIRouter, Depends, Response

from app.auth.deps import Viewer, get_source, require_viewer
from app.auth.policies import Policy
from app.booking.clock import ClockDep
from app.command_centre.schemas import Lookups, Overview
from app.db import SessionDep
from app.deps import ADMIN_ERRORS_DOC
from app.routers.admin_bookings import clinic_zone

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
    response_model_exclude_none=True,
    responses=ADMIN_ERRORS_DOC,
    operation_id="adminOverview",
    summary="Today at a glance",
)
def overview(
    viewer: Annotated[Viewer, Depends(require_viewer(Policy.READ))],
    db: SessionDep,
    clock: ClockDep,
    response: Response,
) -> Overview:
    response.headers["Cache-Control"] = "no-store"
    return get_source(viewer, db).overview(clinic_zone(viewer, db), clock.now())
