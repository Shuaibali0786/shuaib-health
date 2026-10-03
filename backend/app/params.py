"""Validated query and path parameters shared by every catalog route."""

from typing import Annotated, Literal

from fastapi import Path, Query
from pydantic import AfterValidator

SLUG_PATTERN = r"^[a-z0-9]+(-[a-z0-9]+)*$"

Weekday = Literal["mon", "tue", "wed", "thu", "fri", "sat", "sun"]


def _blank_to_none(value: str | None) -> str | None:
    if value is None:
        return None
    stripped = value.strip()
    return stripped or None


PageParam = Annotated[int, Query(ge=1, le=10000)]
PageSizeParam = Annotated[int, Query(alias="pageSize", ge=1, le=100)]
SearchParam = Annotated[
    str | None, Query(min_length=1, max_length=60), AfterValidator(_blank_to_none)
]
SlugPath = Annotated[str, Path(min_length=1, max_length=80, pattern=SLUG_PATTERN)]
SlugQuery = Annotated[str | None, Query(min_length=1, max_length=80, pattern=SLUG_PATTERN)]
WeekdayQuery = Annotated[Weekday | None, Query()]

DEFAULT_PAGE = 1
DEFAULT_PAGE_SIZE = 20
