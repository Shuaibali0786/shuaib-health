"""Book a slot and look a booking up (Feature 005)."""

from typing import Annotated

from fastapi import APIRouter, Depends, Header, Response
from pydantic import UUID4
from sqlalchemy import Engine

from app import schemas
from app.booking import limits, service
from app.booking.clock import ClockDep
from app.booking.reference import parse
from app.db import SessionDep, get_engine
from app.deps import ClientIpDep, ProxySecretDep, SettingsDep
from app.errors import NotFound, RateLimited
from app.logging_config import request_id_var
from app.repositories import appointments as repo

router = APIRouter(tags=["booking"])

EngineDep = Annotated[Engine, Depends(get_engine)]

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
    engine: EngineDep,
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
        engine=engine,
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
    reference: str,
    session: SessionDep,
    engine: EngineDep,
    settings: SettingsDep,
    clock: ClockDep,
    client_ip: ClientIpDep,
    response: Response,
) -> schemas.AppointmentView:
    # Counted before the lookup, found or not, so a reference cannot be guessed at speed.
    retry_after = limits.hit(
        engine,
        limits.lookup_ip_bucket(settings.privacy_hash_key, client_ip),
        limits.LOOKUP_IP_WINDOW,
        settings.lookup_limit_per_ip_per_minute,
        clock.now(),
    )
    if retry_after is not None:
        raise RateLimited(retry_after)
    stored = None
    parsed = parse(reference)
    if parsed is not None:
        stored = repo.get_by_reference(session, parsed)
    if stored is None:
        # Malformed and unknown references look the same, so a reference cannot be probed.
        raise NotFound("Booking")
    response.headers["Cache-Control"] = "no-store"
    return service.view_of(stored.appointment, stored.doctor, stored.time_zone)
