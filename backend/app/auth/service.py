"""Staff sign-in, sign-out, password change and staff administration (ADR-0007).

Each function commits its own unit of work, so a refusal that must leave a trace (a failed sign-in
and its throttle count) is saved before ``AdminError`` is raised. Time is always passed in.
"""

import uuid
from dataclasses import dataclass
from datetime import datetime
from typing import Literal

from sqlalchemy import Engine
from sqlmodel import Session, col, func, select

from app import models as m
from app.auth import audit, events, passwords, sessions, throttle
from app.auth.deps import Viewer
from app.booking.privacy import fingerprint
from app.errors import AdminError, NotFound
from app.settings import Settings

Role = Literal["admin", "receptionist"]


@dataclass(frozen=True)
class Issued:
    token: str
    session: m.StaffSession
    staff: m.StaffAccount


def normalise_email(email: str) -> str:
    return email.strip().lower()


def _staff_by_email(db: Session, email: str) -> m.StaffAccount | None:
    return db.exec(
        select(m.StaffAccount).where(func.lower(col(m.StaffAccount.email)) == email)
    ).first()


def enforce_policy(password: str, email: str, current_hash: str | None = None) -> None:
    reason = passwords.check_policy(password, email=email, current_hash=current_hash)
    if reason is not None:
        raise AdminError("weak_password", extra={"reason": reason})


def sign_in(
    db: Session,
    engine: Engine,
    settings: Settings,
    *,
    email: str,
    password: str,
    presented_token: str | None,
    client_ip: str,
    now: datetime,
) -> Issued:
    fp = fingerprint(settings.privacy_hash_key, client_ip)
    throttle.check_login_ip(engine, settings, client_ip, now)
    typed = normalise_email(email)
    subject = throttle.subject_hash(settings.privacy_hash_key, typed)
    locked = throttle.locked_for(db, subject, now)
    if locked is not None:
        passwords.verify_dummy(password)  # a locked email costs the same time as any other
        audit.record(db, action="auth.sign_in_failed", outcome="locked", fingerprint=fp)
        db.commit()
        events.emit("auth.sign_in_failed")
        raise AdminError("account_locked", retry_after=locked)

    staff = _staff_by_email(db, typed)
    verified = False
    if staff is None or not staff.is_active:
        passwords.verify_dummy(password)
    else:
        verified = passwords.verify_password(staff.password_hash, password)

    if not verified or staff is None:
        outcome: audit.AuthOutcome = (
            "inactive" if staff is not None and not staff.is_active else "bad_credentials"
        )
        audit.record(db, action="auth.sign_in_failed", outcome=outcome, fingerprint=fp)
        newly_locked = throttle.record_failure(db, settings, subject, now)
        if newly_locked:
            audit.record(db, action="auth.lockout", outcome="locked", fingerprint=fp)
        throttle.cleanup(db, now)
        db.commit()
        events.emit("auth.sign_in_failed")
        if newly_locked:
            events.emit("auth.lockout")
            raise AdminError("account_locked", retry_after=settings.login_lock_minutes * 60)
        raise AdminError("sign_in_failed")

    throttle.clear(db, subject)
    sessions.end_presented(db, settings, presented_token, "replaced", now)
    if passwords.needs_rehash(staff.password_hash):
        staff.password_hash = passwords.hash_password(password)
    staff.last_sign_in_at = now
    token, row = sessions.create_staff_session(db, settings, staff, fp, now)
    audit.record(db, action="auth.sign_in", fingerprint=fp, staff_id=staff.id, role=staff.role)
    db.commit()
    return Issued(token, row, staff)


def sign_out(db: Session, viewer: Viewer, now: datetime) -> None:
    if viewer.is_demo:
        sessions.end_demo_session(db, viewer.session_id, now)
    else:
        sessions.end_session(db, viewer.session_id, "sign_out", now)
        audit.record(
            db,
            action="auth.sign_out",
            fingerprint=viewer.fingerprint,
            staff_id=viewer.staff_id,
            role=viewer.staff.role if viewer.staff else None,
        )
    db.commit()


def _id(staff: m.StaffAccount) -> uuid.UUID:
    if staff.id is None:
        raise RuntimeError("staff account was not persisted")
    return staff.id


def change_password(
    db: Session,
    settings: Settings,
    viewer: Viewer,
    *,
    current_password: str,
    new_password: str,
    now: datetime,
) -> Issued:
    staff = viewer.staff
    if staff is None:
        raise AdminError("demo_read_only")
    if not passwords.verify_password(staff.password_hash, current_password):
        raise AdminError("sign_in_failed")
    enforce_policy(new_password, staff.email, staff.password_hash)
    staff.password_hash = passwords.hash_password(new_password)
    staff.must_change_password = False
    staff.password_changed_at = now
    sessions.end_all_for_staff(db, _id(staff), "password_changed", now)
    token, row = sessions.create_staff_session(db, settings, staff, viewer.fingerprint, now)
    audit.record(
        db,
        action="auth.password_changed",
        fingerprint=viewer.fingerprint,
        staff_id=staff.id,
        role=staff.role,
    )
    db.commit()
    return Issued(token, row, staff)


def list_staff(db: Session) -> list[m.StaffAccount]:
    return list(
        db.exec(
            select(m.StaffAccount).order_by(
                col(m.StaffAccount.is_active).desc(),
                col(m.StaffAccount.display_name),
                col(m.StaffAccount.id),
            )
        ).all()
    )


def _audit(db: Session, actor: Viewer, action: audit.AuthAction, target: m.StaffAccount) -> None:
    audit.record(
        db,
        action=action,
        fingerprint=actor.fingerprint,
        staff_id=actor.staff_id,
        role=actor.staff.role if actor.staff else None,
        target_type="staff",
        target_id=target.id,
    )


def create_staff(
    db: Session,
    actor: Viewer,
    *,
    email: str,
    display_name: str,
    role: Role,
    temporary_password: str,
    now: datetime,
) -> m.StaffAccount:
    typed = normalise_email(email)
    if _staff_by_email(db, typed) is not None:
        raise AdminError("email_taken")
    enforce_policy(temporary_password, typed)
    staff = m.StaffAccount(
        email=typed,
        display_name=display_name.strip(),
        role=role,
        password_hash=passwords.hash_password(temporary_password),
        must_change_password=True,
        password_changed_at=now,
        created_by_id=actor.staff_id,
    )
    db.add(staff)
    db.flush()
    _audit(db, actor, "staff.created", staff)
    db.commit()
    return staff


def _locked_staff(db: Session, staff_id: uuid.UUID) -> m.StaffAccount:
    """Lock every admin row (in id order, so two writers cannot deadlock) and the target, then
    return the target as it is now, not as an earlier read saw it."""
    db.exec(
        select(m.StaffAccount.id)
        .where(col(m.StaffAccount.role) == "admin")
        .order_by(col(m.StaffAccount.id))
        .with_for_update()
    ).all()
    target = db.exec(
        select(m.StaffAccount)
        .where(col(m.StaffAccount.id) == staff_id)
        .with_for_update()
        .execution_options(populate_existing=True)
    ).first()
    if target is None:
        raise NotFound("staff")
    return target


def reset_password(
    db: Session, actor: Viewer, staff_id: uuid.UUID, temporary_password: str, now: datetime
) -> None:
    target = _locked_staff(db, staff_id)
    enforce_policy(temporary_password, target.email, target.password_hash)
    target.password_hash = passwords.hash_password(temporary_password)
    target.must_change_password = True
    target.password_changed_at = now
    sessions.end_all_for_staff(db, staff_id, "password_reset", now)
    _audit(db, actor, "staff.password_reset", target)
    db.commit()


def update_staff(
    db: Session,
    actor: Viewer,
    staff_id: uuid.UUID,
    *,
    role: Role | None,
    is_active: bool | None,
    now: datetime,
) -> m.StaffAccount:
    target = _locked_staff(db, staff_id)
    was_active_admin = target.role == "admin" and target.is_active
    new_role = role if role is not None else target.role
    new_active = is_active if is_active is not None else target.is_active
    if was_active_admin and not (new_role == "admin" and new_active):
        others = db.exec(
            select(func.count())
            .select_from(m.StaffAccount)
            .where(
                col(m.StaffAccount.role) == "admin",
                col(m.StaffAccount.is_active).is_(True),
                col(m.StaffAccount.id) != staff_id,
            )
        ).one()
        if others == 0:
            raise AdminError("last_admin")
    actions: list[audit.AuthAction] = []
    if new_role != target.role:
        target.role = new_role
        actions.append("staff.role_changed")
    if new_active != target.is_active:
        target.is_active = new_active
        actions.append("staff.reactivated" if new_active else "staff.deactivated")
        if not new_active:
            sessions.end_all_for_staff(db, staff_id, "deactivated", now)
    for action in actions:
        _audit(db, actor, action, target)
    db.commit()
    return target
