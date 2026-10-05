"""Book a slot and look a booking up (Feature 005)."""

from typing import Annotated

from fastapi import APIRouter, Header, Response
from pydantic import UUID4

from app import schemas
from app.booking import service
from app.booking.clock import ClockDep
from app.booking.reference import parse
from app.db import SessionDep
from app.deps import ClientIpDep, ProxySecretDep, SettingsDep
from app.errors import NotFound
from app.logging_config import request_id_var
from app.repositories import appointments as repo

router = APIRouter(tags=["booking"])

ERROR: dict[str, object] = {"model": schemas.ErrorResponse}
POST_ERRORS: dict[int | str, dict[str, object]] = {
    400: ERROR,
    403: ERROR,
    409: {"model": schemas.BookingConflict},
    422: ERROR,
    429: ERROR,
    503: ERROR,
}
GET_ERRORS: dict[int | str, dict[str, object]] = {404: ERROR, 429: ERROR, 503: ERROR}


@router.post(
    "/appointments",
    status_code=201,
    response_model=schemas.AppointmentView,
    responses=POST_ERRORS,
    dependencies=[ProxySecretDep],
    summary="Book one slot",
)
def create_appointment(
    data: schemas.AppointmentCreate,
    idempotency_key: Annotated[UUID4, Header(alias="Idempotency-Key")],
    session: SessionDep,
    settings: SettingsDep,
    clock: ClockDep,
    client_ip: ClientIpDep,
    response: Response,
) -> schemas.AppointmentView:
    response.headers["Cache-Control"] = "no-store"
    return service.create_appointment(
        session,
        data=data,
        idempotency_key=idempotency_key,
        client_ip=client_ip,
        request_id=request_id_var.get(),
        clock=clock,
        settings=settings,
    )


@router.get(
    "/appointments/{reference}",
    response_model=schemas.AppointmentView,
    responses=GET_ERRORS,
    summary="Masked confirmation view by booking reference",
)
def get_appointment(
    reference: str, session: SessionDep, response: Response
) -> schemas.AppointmentView:
    stored = None
    parsed = parse(reference)
    if parsed is not None:
        stored = repo.get_by_reference(session, parsed)
    if stored is None:
        # Malformed and unknown references look the same, so a reference cannot be probed.
        raise NotFound("Booking")
    response.headers["Cache-Control"] = "no-store"
    return service.view_of(stored.appointment, stored.doctor, stored.time_zone)
