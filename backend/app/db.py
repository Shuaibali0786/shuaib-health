"""Database engine and request-scoped sessions.

The app connects through Neon's pooled (PgBouncer, transaction mode) URL. psycopg's automatic
server-side prepared statements are turned off (``prepare_threshold=None``) because a later
statement may run on a different server connection under transaction pooling.
"""

from collections.abc import Iterator
from functools import lru_cache
from typing import Annotated

from fastapi import Depends
from pydantic import SecretStr
from sqlalchemy import Engine
from sqlmodel import Session, create_engine

from app.settings import get_settings


def make_engine(
    url: SecretStr,
    *,
    connect_timeout: int = 10,
    pool_size: int = 5,
    max_overflow: int = 5,
    pool_timeout: int = 30,
) -> Engine:
    return create_engine(
        url.get_secret_value(),
        pool_size=pool_size,
        max_overflow=max_overflow,
        pool_timeout=pool_timeout,
        pool_pre_ping=True,
        pool_recycle=300,
        connect_args={"prepare_threshold": None, "connect_timeout": connect_timeout},
        echo=False,
        hide_parameters=True,
    )


@lru_cache
def get_engine() -> Engine:
    """The app engine. Small pool: each serverless instance handles few requests at a time."""
    settings = get_settings()
    return make_engine(
        settings.database_url,
        pool_size=settings.db_pool_size,
        max_overflow=settings.db_max_overflow,
        pool_timeout=settings.db_pool_timeout,
    )


def get_session() -> Iterator[Session]:
    with Session(get_engine()) as session:
        yield session


SessionDep = Annotated[Session, Depends(get_session)]
