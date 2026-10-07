"""Staff administration (admins only; Feature 006). A demo viewer sees the sample staff."""

import uuid
from datetime import datetime, timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, Path, Response, status

from app import models as m
from app.auth import service
from app.auth.deps import Viewer, require_viewer, viewer_now
from app.auth.policies import Policy
from app.booking.clock import ClockDep
from app.command_centre.schemas import ResetPasswordRequest, StaffCreate, StaffOut, StaffPatch
from app.db import SessionDep
from app.demo.demo_source import DemoSource
from app.deps import ADMIN_ERRORS_DOC, SettingsDep
from app.schemas import ErrorResponse

router = APIRouter(prefix="/admin", tags=["command-centre"])

WRITE_ERRORS: dict[int | str, dict[str, object]] = {
    **ADMIN_ERRORS_DOC,
    404: {"model": ErrorResponse},
    409: {"model": ErrorResponse},
    422: {"model": ErrorResponse},
}
StaffId = Annotated[uuid.UUID, Path(alias="staffId")]
NO_STORE = {"Cache-Control": "no-store"}


def past_sign_in(at: datetime, now: datetime) -> datetime:
    """A sample sign-in is never later than now: if it would be, it goes back whole days."""
    while at > now:
        at -= timedelta(days=1)
    return at


def staff_out(staff: m.StaffAccount) -> StaffOut:
    if staff.id is None:
        raise RuntimeError("staff account was not persisted")
    return StaffOut(
        id=staff.id,
        email=staff.email,
        display_name=staff.display_name,
        role="admin" if staff.role == "admin" else "receptionist",
        is_active=staff.is_active,
        must_change_password=staff.must_change_password,
        last_sign_in_at=staff.last_sign_in_at,
    )


@router.get(
    "/staff",
    response_model=list[StaffOut],
    response_model_exclude_none=True,
    responses=ADMIN_ERRORS_DOC,
    operation_id="adminStaffList",
    summary="Staff accounts",
)
def list_staff(
    viewer: Annotated[Viewer, Depends(require_viewer(Policy.READ_ADMIN))],
    db: SessionDep,
    clock: ClockDep,
    settings: SettingsDep,
    response: Response,
) -> list[StaffOut]:
    response.headers.update(NO_STORE)
    if viewer.is_demo and viewer.demo_date is not None:
        now = viewer_now(viewer, settings, clock.now())
        return [
            StaffOut(
                id=member.id,
                email=member.email,
                display_name=member.display_name,
                job_title=member.job_title,
                role=member.role,
                is_active=True,
                last_sign_in_at=past_sign_in(member.last_sign_in_at, now),
                is_sample=True,
            )
            for member in DemoSource(viewer.demo_date).staff()
        ]
    return [staff_out(s) for s in service.list_staff(db)]


@router.post(
    "/staff",
    status_code=status.HTTP_201_CREATED,
    response_model=StaffOut,
    response_model_exclude_none=True,
    responses=WRITE_ERRORS,
    operation_id="adminStaffCreate",
    summary="Create a staff account",
)
def create_staff(
    body: StaffCreate,
    viewer: Annotated[Viewer, Depends(require_viewer(Policy.WRITE_ADMIN))],
    db: SessionDep,
    clock: ClockDep,
    response: Response,
) -> StaffOut:
    response.headers.update(NO_STORE)
    staff = service.create_staff(
        db,
        viewer,
        email=body.email,
        display_name=body.display_name,
        role=body.role,
        temporary_password=body.temporary_password,
        now=clock.now(),
    )
    return staff_out(staff)


@router.post(
    "/staff/{staffId}/reset-password",
    status_code=status.HTTP_204_NO_CONTENT,
    responses=WRITE_ERRORS,
    operation_id="adminStaffResetPassword",
    summary="Set a temporary password",
)
def reset_password(
    staff_id: StaffId,
    body: ResetPasswordRequest,
    viewer: Annotated[Viewer, Depends(require_viewer(Policy.WRITE_ADMIN))],
    db: SessionDep,
    clock: ClockDep,
) -> Response:
    service.reset_password(db, viewer, staff_id, body.temporary_password, clock.now())
    return Response(status_code=status.HTTP_204_NO_CONTENT, headers=NO_STORE)


@router.patch(
    "/staff/{staffId}",
    response_model=StaffOut,
    response_model_exclude_none=True,
    responses=WRITE_ERRORS,
    operation_id="adminStaffUpdate",
    summary="Change role or active flag",
)
def update_staff(
    staff_id: StaffId,
    body: StaffPatch,
    viewer: Annotated[Viewer, Depends(require_viewer(Policy.WRITE_ADMIN))],
    db: SessionDep,
    clock: ClockDep,
    response: Response,
) -> StaffOut:
    response.headers.update(NO_STORE)
    staff = service.update_staff(
        db, viewer, staff_id, role=body.role, is_active=body.is_active, now=clock.now()
    )
    return staff_out(staff)
