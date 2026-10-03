"""Alembic environment.

Uses the DIRECT (unpooled) dev URL by default. ``alembic -x target=test ...`` uses
TEST_DATABASE_URL instead. A caller may also pass a ready connection in
``config.attributes["connection"]`` (used by the test suite).
"""

from logging.config import fileConfig

from alembic import context
from sqlalchemy import Connection, create_engine, pool
from sqlmodel import SQLModel

import app.models  # noqa: F401  (registers tables on SQLModel.metadata)
from app.settings import get_settings

config = context.config
if config.config_file_name is not None and config.attributes.get("configure_logging", True):
    fileConfig(config.config_file_name, disable_existing_loggers=False)

target_metadata = SQLModel.metadata


def _url() -> str:
    settings = get_settings()
    target = context.get_x_argument(as_dictionary=True).get("target", "dev")
    if target == "test":
        if settings.test_database_url is None:
            raise SystemExit("TEST_DATABASE_URL is not set; refusing to run test migrations.")
        return settings.test_database_url.get_secret_value()
    if target != "dev":
        raise SystemExit("Unknown -x target; use dev (default) or test.")
    return settings.direct_database_url.get_secret_value()


def _run(connection: Connection) -> None:
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        compare_type=True,
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connection = config.attributes.get("connection")
    if connection is not None:
        _run(connection)
        return
    engine = create_engine(_url(), poolclass=pool.NullPool, hide_parameters=True)
    with engine.connect() as conn:
        _run(conn)
    engine.dispose()


if context.is_offline_mode():
    raise SystemExit("Offline (SQL script) migrations are not supported.")
run_migrations_online()
