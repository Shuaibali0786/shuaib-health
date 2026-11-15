"""The premium voice provider's token endpoint (Feature 013). OFF (404) unless the Azure Speech
key and region are set. Server-to-server only (proxy secret); rate-limited per visitor."""

from typing import Annotated

from fastapi import APIRouter, Depends, Response
from sqlalchemy import Engine

from app import schemas, speech
from app.booking.clock import ClockDep
from app.db import get_engine
from app.deps import ClientIpDep, ProxySecretDep, SettingsDep

router = APIRouter(tags=["speech"])

ERROR: dict[str, object] = {"model": schemas.ErrorResponse}


def get_fetcher() -> speech.Fetcher:
    """How the token is fetched from the speech service (tests override this dependency)."""
    return speech._issue_token


@router.post(
    "/speech/token",
    response_model=schemas.SpeechToken,
    responses={403: ERROR, 404: ERROR, 429: ERROR, 503: ERROR},
    dependencies=[ProxySecretDep],
    summary="A short-lived token for the premium voice provider",
)
def token(
    settings: SettingsDep,
    engine: Annotated[Engine, Depends(get_engine)],
    fetch: Annotated[speech.Fetcher, Depends(get_fetcher)],
    client_ip: ClientIpDep,
    clock: ClockDep,
    response: Response,
) -> schemas.SpeechToken:
    response.headers["Cache-Control"] = "no-store"
    value, region = speech.issue(
        settings=settings, engine=engine, client_ip=client_ip, now=clock.now(), fetch=fetch
    )
    return schemas.SpeechToken(
        token=value, region=region, expires_in_seconds=speech.TOKEN_TTL_SECONDS
    )
