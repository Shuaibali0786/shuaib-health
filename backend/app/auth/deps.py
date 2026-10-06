"""``require_viewer(policy)``: the one gate in front of every Command Centre endpoint (ADR-0007).

Checks run in a fixed order and each refusal has its own code, so a test can tell them apart:
proxy secret and Origin (403 ``forbidden``) -> session token (401) -> CSRF on non-GET (403
``csrf_failed``) -> must-change-password (403) -> demo read-only (403) -> role (403 ``forbidden``).
"""

import uuid
from collections.abc import Callable
from dataclasses import dataclass
from datetime import date, datetime
from typing import Annotated, Any, Literal

from fastapi import Header, Request
from pydantic import SecretStr
from sqlmodel import Session

from app import models as m
from app.auth import sessions, tokens
from app.auth.policies import (
    ADMIN_ONLY_POLICIES,
    PASSWORD_EXEMPT_POLICIES,
    STAFF_ONLY_POLICIES,
    Policy,
)
from app.booking.clock import ClockDep
from app.booking.privacy import fingerprint
from app.command_centre.real_source import RealSource
from app.command_centre.source import CommandCentreSource
from app.db import SessionDep
from app.demo.demo_source import DemoSource
from app.deps import ClientIpDep, SettingsDep, require_proxy_secret
from app.errors import AdminError


@dataclass(frozen=True)
class Viewer:
    kind: Literal["staff", "demo"]
    session_id: uuid.UUID
    csrf_token: str
    expires_at: datetime
    fingerprint: str
    staff: m.StaffAccount | None = None
    demo_date: date | None = None

    @property
    def role(self) -> Literal["admin", "receptionist"] | None:
        if self.staff is None:
            return None
        return "admin" if self.staff.role == "admin" else "receptionist"

    @property
    def staff_id(self) -> uuid.UUID | None:
        return self.staff.id if self.staff else None

    @property
    def is_demo(self) -> bool:
        return self.kind == "demo"


def _authorise(
    policy: Policy, viewer: Viewer, method: str, presented_csrf: str | None, key: SecretStr
) -> None:
    if method not in ("GET", "HEAD", "OPTIONS") and not tokens.verify_csrf(
        key, viewer.session_id, presented_csrf
    ):
        raise AdminError("csrf_failed")
    must_change = viewer.staff is not None and viewer.staff.must_change_password
    if must_change and policy not in PASSWORD_EXEMPT_POLICIES:
        raise AdminError("password_change_required")
    if viewer.is_demo and policy in STAFF_ONLY_POLICIES:
        raise AdminError("demo_read_only")
    if policy in ADMIN_ONLY_POLICIES and viewer.role != "admin":
        raise AdminError("forbidden")
    if policy is Policy.READ_ADMIN and not viewer.is_demo and viewer.role != "admin":
        raise AdminError("forbidden")


def require_viewer(policy: Policy) -> Callable[..., Any]:
    """A FastAPI dependency enforcing ``policy``. Marked with ``.policy`` for the route test.

    It returns the ``Viewer`` (``None`` for ``PUBLIC_PROXY``, which has no session).
    """

    def dependency(
        request: Request,
        settings: SettingsDep,
        db: SessionDep,
        clock: ClockDep,
        client_ip: ClientIpDep,
        session_token: Annotated[str | None, Header(alias="X-Session-Token")] = None,
        csrf: Annotated[str | None, Header(alias="X-CSRF-Token")] = None,
    ) -> Viewer | None:
        require_proxy_secret(request, settings)
        if policy is Policy.PUBLIC_PROXY:
            return None
        resolved = sessions.resolve(db, settings, session_token, clock.now())
        viewer = Viewer(
            kind=resolved.kind,
            session_id=resolved.session_id,
            csrf_token=tokens.csrf_token(settings.session_secret, resolved.session_id),
            expires_at=resolved.expires_at,
            fingerprint=fingerprint(settings.privacy_hash_key, client_ip),
            staff=resolved.staff,
            demo_date=resolved.demo_date,
        )
        request.state.cc_role = viewer.role or "demo"
        _authorise(policy, viewer, request.method, csrf, settings.session_secret)
        return viewer

    dependency.policy = policy  # type: ignore[attr-defined]
    return dependency


def get_source(viewer: Viewer, db: Session) -> CommandCentreSource:
    """Staff read the real database; demo visitors read the in-memory synthetic dataset."""
    if viewer.kind == "demo":
        if viewer.demo_date is None:
            raise AdminError("not_signed_in")
        return DemoSource(viewer.demo_date)
    return RealSource(db)
