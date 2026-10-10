"""Stop a command that writes data from hitting the wrong database (007, FR-050).

The guard checks the URL the command connects with (``DATABASE_URL``). The Neon pooled and direct
hosts of one database count as the same database. It prints the masked host and the database name,
then refuses unless all of these hold:

* the host is one of the ``--expect-host`` values given on the command line;
* the URL is not the development database named in the local ``backend/.env``;
* the operator types the database name.

Nothing here prints a URL, a user name, a password or the full host.
"""

import argparse
from collections.abc import Callable, Iterable
from pathlib import Path
from typing import TextIO

from app.settings import ENV_FILE, normalise_db_url

_LOCAL_URL_KEYS = ("DATABASE_URL", "DIRECT_DATABASE_URL", "TEST_DATABASE_URL")


class GuardRefusal(Exception):
    """A refusal with a message that is safe to print."""


def add_guard_arguments(parser: argparse.ArgumentParser) -> None:
    parser.add_argument(
        "--expect-host",
        action="append",
        default=[],
        metavar="HOST",
        help="the exact database host this run must connect to (repeatable)",
    )


def mask_host(host: str) -> str:
    """Keep six characters of the host name and the domain: ``ep-coo***.aws.neon.tech``."""
    first, dot, rest = host.partition(".")
    return f"{first[:6]}***{dot}{rest}"


def _identity(url: str) -> tuple[str, int | None, str]:
    host, port, database = normalise_db_url(url)
    return host.replace("-pooler", ""), port, database


def local_env_targets(env_file: Path = ENV_FILE) -> set[tuple[str, int | None, str]]:
    """Databases named in the local ``.env`` (identity only: no credentials are kept)."""
    targets: set[tuple[str, int | None, str]] = set()
    if not env_file.is_file():
        return targets
    for line in env_file.read_text(encoding="utf-8").splitlines():
        key, sep, value = line.strip().partition("=")
        if sep and key.strip().upper() in _LOCAL_URL_KEYS:
            url = value.strip().strip("'\"")
            if url:
                targets.add(_identity(url))
    return targets


def confirm_target(
    url: str,
    *,
    expect_hosts: Iterable[str],
    out: TextIO,
    ask: Callable[[str], str] | None = None,
    env_file: Path = ENV_FILE,
) -> None:
    """Raise ``GuardRefusal`` unless it is safe to write to ``url``."""
    host, _port, database = normalise_db_url(url)
    print(f"Target database host: {mask_host(host)}", file=out)
    print(f"Target database name: {database}", file=out)

    allowed = {h.strip().lower().replace("-pooler", "") for h in expect_hosts if h.strip()}
    if not allowed:
        raise GuardRefusal("Refusing: pass --expect-host with the host you mean to change.")
    if host.replace("-pooler", "") not in allowed:
        raise GuardRefusal("Refusing: the database host is not one of the --expect-host values.")
    if _identity(url) in local_env_targets(env_file):
        raise GuardRefusal("Refusing: this is the development database named in the local .env.")
    typed = (ask or input)("Type the database name to continue: ")
    if typed.strip() != database:
        raise GuardRefusal("Refusing: the database name you typed does not match.")
