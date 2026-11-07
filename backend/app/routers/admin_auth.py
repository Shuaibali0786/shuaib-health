"""Command Centre sign-in, sign-out, password change and ``me`` (Feature 006)."""

from datetime import datetime
from typing import Annotated
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, Header, Response, status
from fastapi.responses import JSONResponse
from sqlalchemy import Engine

from app.auth import events, service, sessions, tokens, two_factor
from app.auth.deps import Viewer, demo_clock, require_viewer
from app.auth.policies import Policy
from app.booking import limits
from app.booking.clock import ClockDep
from app.booking.privacy import fingerprint
from app.command_centre.schemas import (
    BackupCodesOut,
    ChangePasswordRequest,
    SessionIssued,
    SignInRequest,
    TwoFactorChallenge,
    TwoFactorConfirmRequest,
    TwoFactorEnableRequest,
    TwoFactorSetupOut,
    TwoFactorSetupRequest,
    TwoFactorStatusOut,
    TwoFactorVerifyRequest,
    ViewerOut,
)
from app.db import SessionDep, get_engine
from app.demo.clock import demo_now
from app.deps import ADMIN_ERRORS_DOC, ClientIpDep, SettingsDep
from app.errors import ClinicNotConfigured, NotFound, RateLimited
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
TWO_FACTOR_ERRORS: dict[int | str, dict[str, object]] = {
    **ISSUE_ERRORS,
    409: {"model": ErrorResponse},
    503: {"model": ErrorResponse},
}


def clinic_timezone(db: SessionDep) -> str:
    settings = clinic_repo.get_clinic_settings(db)
    if settings is None:
        raise ClinicNotConfigured
    return settings.time_zone


def viewer_out(viewer: Viewer, timezone: str, now: datetime, settings: Settings) -> ViewerOut:
    today = viewer.demo_date or now.astimezone(ZoneInfo(timezone)).date()
    shown = demo_clock(viewer, settings, now)
    return ViewerOut(
        kind=viewer.kind,
        role=viewer.role,
        display_name=viewer.staff.display_name if viewer.staff else None,
        must_change_password=viewer.staff.must_change_password if viewer.staff else None,
        csrf_token=viewer.csrf_token,
        clinic_today=today,
        timezone=timezone,
        session_expires_at=viewer.expires_at,
        demo_now=shown.at if shown else None,
        typical_day=shown.typical if shown else None,
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


@router.post(
    "/demo/start",
    response_model=SessionIssued,
    response_model_exclude_none=True,
    responses=ISSUE_ERRORS,
    operation_id="adminDemoStart",
    summary="Start a read-only demo",
)
def demo_start(
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
    """A 2-hour demo for today's clinic date. Any session presented with the request ends first."""
    response.headers.update(NO_STORE)
    if not settings.demo_enabled:
        raise NotFound("Demo")
    now = clock.now()
    bucket = limits.demo_ip_bucket(settings.privacy_hash_key, client_ip)
    retry = limits.hit(
        engine, bucket, limits.DEMO_IP_WINDOW, settings.demo_limit_per_ip_per_hour, now
    )
    if retry is not None:
        raise RateLimited(retry)
    sessions.end_presented(db, settings, session_token, "replaced", now)
    demo_date = now.astimezone(ZoneInfo(timezone)).date()
    fp = fingerprint(settings.privacy_hash_key, client_ip)
    token, row = sessions.create_demo_session(db, settings, demo_date, fp, now)
    db.commit()
    if row.id is None:
        raise RuntimeError("session was not persisted")
    events.emit("demo.started")
    shown = demo_now(now, demo_date, now)
    viewer = ViewerOut(
        kind="demo",
        csrf_token=tokens.csrf_token(settings.session_secret, row.id),
        clinic_today=demo_date,
        timezone=timezone,
        session_expires_at=row.expires_at,
        demo_now=shown.at,
        typical_day=shown.typical,
    )
    return SessionIssued(token=token, viewer=viewer)


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
    settings: SettingsDep,
    timezone: Annotated[str, Depends(clinic_timezone)],
    clock: ClockDep,
    response: Response,
) -> ViewerOut:
    response.headers["Cache-Control"] = "no-store"
    response.headers["X-Robots-Tag"] = "noindex"
    return viewer_out(viewer, timezone, clock.now(), settings)


@router.post(
    "/auth/sign-in",
    response_model=SessionIssued,
    response_model_exclude_none=True,
    responses={
        **ISSUE_ERRORS,
        202: {"model": TwoFactorChallenge, "description": "Two-step sign-in: enter a code next"},
    },
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
) -> SessionIssued | JSONResponse:
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
    if isinstance(issued, two_factor.Challenge):
        challenge = TwoFactorChallenge(challenge_token=issued.token, expires_at=issued.expires_at)
        return JSONResponse(
            challenge.model_dump(mode="json", by_alias=True),
            status_code=status.HTTP_202_ACCEPTED,
            headers=NO_STORE,
        )
    return _issued_out(issued, settings, timezone, now)


@router.post(
    "/auth/sign-in/two-factor",
    response_model=SessionIssued,
    response_model_exclude_none=True,
    responses=TWO_FACTOR_ERRORS,
    operation_id="adminSignInTwoFactor",
    summary="Finish signing in with an app code or a backup code",
)
def sign_in_two_factor(
    body: TwoFactorVerifyRequest,
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
    issued = service.verify_two_factor(
        db,
        engine,
        settings,
        challenge_token=body.challenge_token,
        code=body.code,
        backup_code=body.backup_code,
        presented_token=session_token,
        client_ip=client_ip,
        now=now,
    )
    return _issued_out(issued, settings, timezone, now)


def clinic_name(db: SessionDep) -> str:
    settings = clinic_repo.get_clinic_settings(db)
    if settings is None:
        raise ClinicNotConfigured
    return settings.name


@router.get(
    "/auth/two-factor",
    response_model=TwoFactorStatusOut,
    response_model_exclude_none=True,
    responses=ADMIN_ERRORS_DOC,
    operation_id="adminTwoFactorStatus",
    summary="Two-step sign-in status for the signed-in staff member",
)
def two_factor_status(
    viewer: Annotated[Viewer, Depends(require_viewer(Policy.SELF_STAFF))],
    db: SessionDep,
    settings: SettingsDep,
    response: Response,
) -> TwoFactorStatusOut:
    response.headers.update(NO_STORE)
    current = two_factor.status(db, settings, viewer)
    return TwoFactorStatusOut(
        available=current.available,
        enabled=current.enabled,
        enabled_at=current.enabled_at,
        backup_codes_left=current.backup_codes_left,
        can_enrol=current.can_enrol,
    )


@router.post(
    "/auth/two-factor/setup",
    response_model=TwoFactorSetupOut,
    responses=TWO_FACTOR_ERRORS,
    operation_id="adminTwoFactorSetup",
    summary="Start two-step sign-in setup (password required)",
)
def two_factor_setup(
    body: TwoFactorSetupRequest,
    viewer: Annotated[Viewer, Depends(require_viewer(Policy.SELF_STAFF))],
    db: SessionDep,
    settings: SettingsDep,
    issuer: Annotated[str, Depends(clinic_name)],
    clock: ClockDep,
    response: Response,
) -> TwoFactorSetupOut:
    response.headers.update(NO_STORE)
    key = two_factor.start_setup(
        db,
        settings,
        viewer,
        current_password=body.current_password,
        issuer=issuer,
        now=clock.now(),
    )
    return TwoFactorSetupOut(secret=key.secret, otpauth_uri=key.otpauth_uri)


@router.post(
    "/auth/two-factor/enable",
    response_model=BackupCodesOut,
    responses=TWO_FACTOR_ERRORS,
    operation_id="adminTwoFactorEnable",
    summary="Finish setup with a code from the app; returns the backup codes once",
)
def two_factor_enable(
    body: TwoFactorEnableRequest,
    viewer: Annotated[Viewer, Depends(require_viewer(Policy.SELF_STAFF))],
    db: SessionDep,
    settings: SettingsDep,
    clock: ClockDep,
    response: Response,
) -> BackupCodesOut:
    response.headers.update(NO_STORE)
    codes = two_factor.enable(db, settings, viewer, code=body.code, now=clock.now())
    return BackupCodesOut(backup_codes=codes)


@router.post(
    "/auth/two-factor/disable",
    status_code=status.HTTP_204_NO_CONTENT,
    responses=TWO_FACTOR_ERRORS,
    operation_id="adminTwoFactorDisable",
    summary="Turn two-step sign-in off (password and a code required)",
)
def two_factor_disable(
    body: TwoFactorConfirmRequest,
    viewer: Annotated[Viewer, Depends(require_viewer(Policy.SELF_STAFF))],
    db: SessionDep,
    settings: SettingsDep,
    clock: ClockDep,
) -> Response:
    two_factor.disable(
        db,
        settings,
        viewer,
        current_password=body.current_password,
        code=body.code,
        backup_code=body.backup_code,
        now=clock.now(),
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT, headers=NO_STORE)


@router.post(
    "/auth/two-factor/backup-codes",
    response_model=BackupCodesOut,
    responses=TWO_FACTOR_ERRORS,
    operation_id="adminTwoFactorBackupCodes",
    summary="Replace the backup codes (password and a code required)",
)
def two_factor_backup_codes(
    body: TwoFactorConfirmRequest,
    viewer: Annotated[Viewer, Depends(require_viewer(Policy.SELF_STAFF))],
    db: SessionDep,
    settings: SettingsDep,
    clock: ClockDep,
    response: Response,
) -> BackupCodesOut:
    response.headers.update(NO_STORE)
    codes = two_factor.regenerate_backup_codes(
        db,
        settings,
        viewer,
        current_password=body.current_password,
        code=body.code,
        backup_code=body.backup_code,
        now=clock.now(),
    )
    return BackupCodesOut(backup_codes=codes)


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
