"""Command Centre sign-in, sign-out, password change and ``me`` (Feature 006)."""

from datetime import datetime
from typing import Annotated
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, Header, Response, status
from sqlalchemy import Engine

from app.auth import service, tokens
from app.auth.deps import Viewer, require_viewer
from app.auth.policies import Policy
from app.booking.clock import ClockDep
from app.command_centre.schemas import (
    ChangePasswordRequest,
    SessionIssued,
    SignInRequest,
    ViewerOut,
)
from app.db import SessionDep, get_engine
from app.deps import ADMIN_ERRORS_DOC, ClientIpDep, SettingsDep
from app.errors import ClinicNotConfigured
from app.repositories import clinic as clinic_repo
from app.schemas import ErrorResponse
from app.settings import Settings

router = APIRouter(prefix="/admin", tags=["command-centre"])

NO_STORE = {"Cache-Control": "no-store"}
ISSUE_ERRORS: dict[int | str, dict[str, object]] = {
    **ADMIN_ERRORS_DOC,
    422: {"model": ErrorResponse},
    429: {"model": ErrorResponse},
}


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


def _issued_out(
    issued: service.Issued, settings: Settings, timezone: str, now: datetime
) -> SessionIssued:
    session_id = issued.session.id
    if session_id is None:
        raise RuntimeError("session was not persisted")
    viewer = ViewerOut(
        kind="staff",
        role="admin" if issued.staff.role == "admin" else "receptionist",
        display_name=issued.staff.display_name,
        must_change_password=issued.staff.must_change_password,
        csrf_token=tokens.csrf_token(settings.session_secret, session_id),
        clinic_today=now.astimezone(ZoneInfo(timezone)).date(),
        timezone=timezone,
        session_expires_at=min(issued.session.idle_expires_at, issued.session.absolute_expires_at),
    )
    return SessionIssued(token=issued.token, viewer=viewer)


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


@router.post(
    "/auth/sign-in",
    response_model=SessionIssued,
    response_model_exclude_none=True,
    responses=ISSUE_ERRORS,
    operation_id="adminSignIn",
    summary="Sign in",
)
def sign_in(
    body: SignInRequest,
    _: Annotated[None, Depends(require_viewer(Policy.PUBLIC_PROXY))],
    db: SessionDep,
    engine: Annotated[Engine, Depends(get_engine)],
    settings: SettingsDep,
    client_ip: ClientIpDep,
    timezone: Annotated[str, Depends(clinic_timezone)],
    clock: ClockDep,
    response: Response,
    session_token: Annotated[str | None, Header(alias="X-Session-Token")] = None,
) -> SessionIssued:
    response.headers.update(NO_STORE)
    now = clock.now()
    issued = service.sign_in(
        db,
        engine,
        settings,
        email=body.email,
        password=body.password,
        presented_token=session_token,
        client_ip=client_ip,
        now=now,
    )
    return _issued_out(issued, settings, timezone, now)


@router.post(
    "/auth/sign-out",
    status_code=status.HTTP_204_NO_CONTENT,
    responses=ADMIN_ERRORS_DOC,
    operation_id="adminSignOut",
    summary="Sign out",
)
def sign_out(
    viewer: Annotated[Viewer, Depends(require_viewer(Policy.SELF))],
    db: SessionDep,
    clock: ClockDep,
) -> Response:
    service.sign_out(db, viewer, clock.now())
    return Response(status_code=status.HTTP_204_NO_CONTENT, headers=NO_STORE)


@router.post(
    "/auth/change-password",
    response_model=SessionIssued,
    response_model_exclude_none=True,
    responses=ISSUE_ERRORS,
    operation_id="adminChangePassword",
    summary="Change your password",
)
def change_password(
    body: ChangePasswordRequest,
    viewer: Annotated[Viewer, Depends(require_viewer(Policy.SELF_STAFF))],
    db: SessionDep,
    settings: SettingsDep,
    timezone: Annotated[str, Depends(clinic_timezone)],
    clock: ClockDep,
    response: Response,
) -> SessionIssued:
    response.headers.update(NO_STORE)
    now = clock.now()
    issued = service.change_password(
        db,
        settings,
        viewer,
        current_password=body.current_password,
        new_password=body.new_password,
        now=now,
    )
    return _issued_out(issued, settings, timezone, now)
