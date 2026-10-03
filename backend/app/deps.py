"""Shared route dependencies and OpenAPI error documentation."""

from typing import Annotated

from fastapi import Depends, Request

from app.schemas import ErrorResponse
from app.settings import Settings


def get_app_settings(request: Request) -> Settings:
    settings: Settings = request.app.state.settings
    return settings


SettingsDep = Annotated[Settings, Depends(get_app_settings)]

LIST_ERRORS: dict[int | str, dict[str, object]] = {
    422: {"model": ErrorResponse},
    429: {"model": ErrorResponse},
}
DETAIL_ERRORS: dict[int | str, dict[str, object]] = {404: {"model": ErrorResponse}, **LIST_ERRORS}
