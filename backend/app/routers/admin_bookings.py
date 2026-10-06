"""Bookings in the Command Centre: search, detail, status changes, undo and phone reveal (US4).

Reads go through the data-source seam (a staff session reads the database, a demo session the
synthetic dataset). Writes are staff only; the demo's changes live in the browser (ADR-0009).
"""

from typing import Annotated
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, Path, Response
from sqlmodel import Session

from app.auth.deps import Viewer, get_source, require_viewer
from app.auth.policies import Policy
from app.booking.clock import ClockDep
from app.command_centre import service
from app.command_centre.schemas import (
    BookingChanged,
    BookingDetail,
    BookingPage,
    BookingSearchRequest,
    PhoneReveal,
    StatusChangeRequest,
    StatusChangeResult,
    UndoRequest,
)
from app.db import SessionDep
from app.demo import generator
from app.demo.demo_source import DemoSource
from app.deps import ADMIN_ERRORS_DOC
from app.errors import ClinicNotConfigured
from app.repositories import clinic as clinic_repo
from app.schemas import ErrorResponse

router = APIRouter(prefix="/admin", tags=["command-centre"])

NO_STORE = {"Cache-Control": "no-store"}
Reference = Annotated[str, Path(pattern=r"^[0-9A-Za-z]{10}$", min_length=10, max_length=10)]
READ_ERRORS: dict[int | str, dict[str, object]] = {
    **ADMIN_ERRORS_DOC,
    404: {"model": ErrorResponse},
    422: {"model": ErrorResponse},
}
CONFLICT_ERRORS: dict[int | str, dict[str, object]] = {
    **READ_ERRORS,
    409: {"model": BookingChanged},
}


def clinic_zone(viewer: Viewer, db: Session) -> ZoneInfo:
    if viewer.is_demo:
        return ZoneInfo(generator.CLINIC_TZ_NAME)
    settings = clinic_repo.get_clinic_settings(db)
    if settings is None:
        raise ClinicNotConfigured
    return ZoneInfo(settings.time_zone)


@router.post(
    "/bookings/search",
    response_model=BookingPage,
    response_model_exclude_none=True,
    responses=READ_ERRORS,
    operation_id="adminBookingSearch",
    summary="Search bookings",
)
def search_bookings(
    body: BookingSearchRequest,
    viewer: Annotated[Viewer, Depends(require_viewer(Policy.READ))],
    db: SessionDep,
    clock: ClockDep,
    response: Response,
) -> BookingPage:
    response.headers.update(NO_STORE)
    source = get_source(viewer, db)
    return source.search(body, clinic_zone(viewer, db), clock.now())


@router.get(
    "/bookings/{reference}",
    response_model=BookingDetail,
    response_model_exclude_none=True,
    responses=READ_ERRORS,
    operation_id="adminBookingDetail",
    summary="One booking",
)
def booking_detail(
    reference: Reference,
    viewer: Annotated[Viewer, Depends(require_viewer(Policy.READ))],
    db: SessionDep,
    clock: ClockDep,
    response: Response,
) -> BookingDetail:
    response.headers.update(NO_STORE)
    source = get_source(viewer, db)
    return source.detail(reference, clinic_zone(viewer, db), clock.now())


@router.post(
    "/bookings/{reference}/reveal-phone",
    response_model=PhoneReveal,
    responses=READ_ERRORS,
    operation_id="adminBookingRevealPhone",
    summary="Reveal the full phone number",
)
def reveal_phone(
    reference: Reference,
    viewer: Annotated[Viewer, Depends(require_viewer(Policy.READ))],
    db: SessionDep,
    response: Response,
) -> PhoneReveal:
    response.headers.update(NO_STORE)
    if viewer.is_demo and viewer.demo_date is not None:
        return DemoSource(viewer.demo_date).reveal_phone(reference)
    return service.reveal_phone(db, viewer, reference)


@router.post(
    "/bookings/{reference}/status",
    response_model=StatusChangeResult,
    response_model_exclude_none=True,
    responses=CONFLICT_ERRORS,
    operation_id="adminBookingChangeStatus",
    summary="Change a booking's status",
)
def change_status(
    reference: Reference,
    body: StatusChangeRequest,
    viewer: Annotated[Viewer, Depends(require_viewer(Policy.WRITE))],
    db: SessionDep,
    clock: ClockDep,
    response: Response,
) -> StatusChangeResult:
    response.headers.update(NO_STORE)
    return service.change_status(
        db,
        viewer,
        reference,
        to=body.to,
        expected_version=body.expected_version,
        tz=clinic_zone(viewer, db),
        now=clock.now(),
    )


@router.post(
    "/bookings/{reference}/status/undo",
    response_model=BookingDetail,
    response_model_exclude_none=True,
    responses=CONFLICT_ERRORS,
    operation_id="adminBookingUndoStatus",
    summary="Undo the latest status change",
)
def undo_status(
    reference: Reference,
    body: UndoRequest,
    viewer: Annotated[Viewer, Depends(require_viewer(Policy.WRITE))],
    db: SessionDep,
    clock: ClockDep,
    response: Response,
) -> BookingDetail:
    response.headers.update(NO_STORE)
    return service.undo(
        db,
        viewer,
        reference,
        change_id=body.change_id,
        tz=clinic_zone(viewer, db),
        now=clock.now(),
    )
