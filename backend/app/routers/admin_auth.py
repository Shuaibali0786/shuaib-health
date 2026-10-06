"""Command Centre sign-in state (Feature 006). More routes land here with the sign-in story."""

from datetime import datetime
from typing import Annotated
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, Response

from app.auth.deps import Viewer, require_viewer
from app.auth.policies import Policy
from app.booking.clock import ClockDep
from app.command_centre.schemas import ViewerOut
from app.db import SessionDep
from app.deps import ADMIN_ERRORS_DOC
from app.errors import ClinicNotConfigured
from app.repositories import clinic as clinic_repo

router = APIRouter(prefix="/admin", tags=["command-centre"])


def clinic_timezone(db: SessionDep) -> str:
    settings = clinic_repo.get_clinic_settings(db)
    if settings is None:
        raise ClinicNotConfigured
    return settings.time_zone


def viewer_out(viewer: Viewer, timezone: str, now: datetime) -> ViewerOut:
    today = viewer.demo_date or now.astimezone(ZoneInfo(timezone)).date()
    return ViewerOut(
        kind=viewer.kind,
        role=viewer.role,
        display_name=viewer.staff.display_name if viewer.staff else None,
        must_change_password=viewer.staff.must_change_password if viewer.staff else None,
        csrf_token=viewer.csrf_token,
        clinic_today=today,
        timezone=timezone,
        session_expires_at=viewer.expires_at,
    )


@router.get(
    "/auth/me",
    response_model=ViewerOut,
    response_model_exclude_none=True,
    responses=ADMIN_ERRORS_DOC,
    operation_id="adminMe",
    summary="Who is signed in",
)
def me(
    viewer: Annotated[Viewer, Depends(require_viewer(Policy.SELF))],
    timezone: Annotated[str, Depends(clinic_timezone)],
    clock: ClockDep,
    response: Response,
) -> ViewerOut:
    response.headers["Cache-Control"] = "no-store"
    response.headers["X-Robots-Tag"] = "noindex"
    return viewer_out(viewer, timezone, clock.now())
