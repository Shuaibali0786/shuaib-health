"""The assistant's optional Claude provider (Feature 010 v1.1). OFF by default: without
``ASSISTANT_AI_ENABLED=true`` and ``ANTHROPIC_API_KEY`` this answers 503 and the website keeps
its free built-in engine. Server-to-server only (proxy secret)."""

from typing import Annotated

from fastapi import APIRouter, Depends, Response
from sqlalchemy import Engine

from app import schemas
from app.assistant import claude
from app.booking.clock import ClockDep
from app.db import get_engine
from app.deps import ClientIpDep, ProxySecretDep, SettingsDep
from app.errors import ServiceUnavailable

router = APIRouter(tags=["assistant"])

ERROR: dict[str, object] = {"model": schemas.ErrorResponse}


def get_claude_client(settings: SettingsDep) -> claude.MessagesClient:
    """The Anthropic client, only when the provider is on (tests override this dependency)."""
    if not claude.is_enabled(settings):
        raise ServiceUnavailable
    return claude.make_client(settings)


@router.post(
    "/assistant/answer",
    response_model=schemas.AssistantAnswer,
    responses={403: ERROR, 422: ERROR, 429: ERROR, 503: ERROR},
    dependencies=[ProxySecretDep],
    summary="Answer one website question with the optional AI provider",
)
def answer(
    body: schemas.AssistantQuestion,
    settings: SettingsDep,
    client: Annotated[claude.MessagesClient, Depends(get_claude_client)],
    engine: Annotated[Engine, Depends(get_engine)],
    client_ip: ClientIpDep,
    clock: ClockDep,
    response: Response,
) -> schemas.AssistantAnswer:
    response.headers["Cache-Control"] = "no-store"
    result = claude.answer(
        client=client,
        engine=engine,
        settings=settings,
        question=body.question,
        pack=body.pack,
        client_ip=client_ip,
        now=clock.now(),
    )
    return schemas.AssistantAnswer(text=result.text)
