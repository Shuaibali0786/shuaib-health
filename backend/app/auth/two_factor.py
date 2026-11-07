"""Two-step sign-in with an authenticator app (Feature 011, ADR-0014).

Each function commits its own unit of work. A refusal that must leave a trace (a failed code, an
attempt count, a lockout) is committed before ``AdminError`` or ``RequestInvalid`` is raised. Codes,
secrets and passwords never reach a log, an audit row or an error message.
"""

import secrets as pysecrets
import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta

from sqlalchemy import Engine, text
from sqlmodel import Session, col, delete, func, select

from app import models as m
from app.auth import audit, passwords, secretbox, sessions, throttle, tokens, totp
from app.auth.deps import Viewer
from app.booking.privacy import fingerprint
from app.errors import AdminError, NotFound, RequestInvalid
from app.settings import Settings

CHALLENGE_PREFIX = "shc_"
CHALLENGE_TTL = timedelta(minutes=5)
MAX_ATTEMPTS = 5
PENDING_TTL = timedelta(minutes=15)
SYSTEM_FINGERPRINT = "0" * 16


@dataclass(frozen=True)
class Challenge:
    token: str
    expires_at: datetime


@dataclass(frozen=True)
class Status:
    available: bool
    enabled: bool
    enabled_at: datetime | None
    backup_codes_left: int | None
    can_enrol: bool


@dataclass(frozen=True)
class SetupKey:
    secret: str  # base32, shown once so the person can type it into the app
    otpauth_uri: str


def is_enrolled(staff: m.StaffAccount) -> bool:
    return staff.totp_enabled_at is not None


def _id(staff: m.StaffAccount) -> uuid.UUID:
    if staff.id is None:
        raise RuntimeError("staff account was not persisted")
    return staff.id


def _key(settings: Settings) -> bytes:
    key = secretbox.key_from(settings)
    if key is None:
        raise AdminError("two_factor_unavailable")
    return key


def _secret(key: bytes, staff: m.StaffAccount) -> bytes:
    if staff.totp_secret_encrypted is None:
        raise AdminError("two_factor_not_started")
    try:
        return secretbox.decrypt(key, _id(staff), staff.totp_secret_encrypted)
    except secretbox.SecretUnreadable as error:
        raise AdminError("two_factor_unavailable") from error


def _new_backup_codes(db: Session, key: bytes, staff_id: uuid.UUID) -> list[str]:
    db.exec(delete(m.StaffBackupCode).where(col(m.StaffBackupCode.staff_id) == staff_id))
    codes = [secretbox.new_backup_code() for _ in range(secretbox.BACKUP_COUNT)]
    for code in codes:
        normalised = secretbox.normalise_backup_code(code)
        if normalised is None:  # pragma: no cover - the generator only makes valid codes
            raise RuntimeError("generated an invalid backup code")
        db.add(
            m.StaffBackupCode(
                staff_id=staff_id, code_hash=secretbox.backup_code_hash(key, normalised)
            )
        )
    db.flush()
    return codes


def _use_backup_code(
    db: Session, key: bytes, staff_id: uuid.UUID, typed: str, now: datetime
) -> bool:
    """Marks the code used, once: a second use (or a racing request) finds no unused row."""
    normalised = secretbox.normalise_backup_code(typed)
    if normalised is None:
        return False
    used = db.execute(
        text(
            "UPDATE staff_backup_code SET used_at = :now WHERE staff_id = :staff "
            "AND code_hash = :hash AND used_at IS NULL RETURNING id"
        ),
        {"now": now, "staff": staff_id, "hash": secretbox.backup_code_hash(key, normalised)},
    ).first()
    return used is not None


def _check_second_factor(
    db: Session,
    key: bytes,
    staff: m.StaffAccount,
    *,
    code: str | None,
    backup_code: str | None,
    now: datetime,
) -> tuple[bool, bool]:
    """(passed, used_backup_code). Exactly one of ``code``/``backup_code`` is expected."""
    if backup_code is not None:
        return _use_backup_code(db, key, _id(staff), backup_code, now), True
    verdict, step = totp.verify(
        _secret(key, staff), code or "", now.timestamp(), staff.totp_last_step
    )
    if verdict == "ok":
        staff.totp_last_step = step
        return True, False
    return False, False


def _one_factor(code: str | None, backup_code: str | None) -> None:
    if (code is None) == (backup_code is None):
        raise RequestInvalid("code", "give either an app code or a backup code")


# --- status and setup ------------------------------------------------------------------------


def backup_codes_left(db: Session, staff_id: uuid.UUID) -> int:
    return db.exec(
        select(func.count())
        .select_from(m.StaffBackupCode)
        .where(
            col(m.StaffBackupCode.staff_id) == staff_id, col(m.StaffBackupCode.used_at).is_(None)
        )
    ).one()


def status(db: Session, settings: Settings, viewer: Viewer) -> Status:
    staff = viewer.staff
    available = secretbox.key_from(settings) is not None
    if staff is None:
        return Status(available, False, None, None, False)
    enabled = is_enrolled(staff)
    return Status(
        available=available,
        enabled=enabled,
        enabled_at=staff.totp_enabled_at,
        backup_codes_left=backup_codes_left(db, _id(staff)) if enabled else None,
        can_enrol=available and staff.role == "admin" and not enabled,
    )


def start_setup(
    db: Session,
    settings: Settings,
    viewer: Viewer,
    *,
    current_password: str,
    issuer: str,
    now: datetime,
) -> SetupKey:
    staff = viewer.staff
    if staff is None:
        raise AdminError("demo_read_only")
    if staff.role != "admin":
        raise AdminError("two_factor_admins_only")
    key = _key(settings)
    if staff.must_change_password:
        raise AdminError("password_change_required")
    if is_enrolled(staff):
        raise AdminError("two_factor_already_on")
    if not passwords.verify_password(staff.password_hash, current_password):
        raise RequestInvalid("currentPassword", "is incorrect")
    pending_fresh = (
        staff.totp_secret_encrypted is not None
        and staff.totp_setup_started_at is not None
        and now - staff.totp_setup_started_at < PENDING_TTL
    )
    if pending_fresh:
        secret = _secret(key, staff)
    else:
        secret = totp.new_secret()
        staff.totp_secret_encrypted = secretbox.encrypt(key, _id(staff), secret)
        staff.totp_setup_started_at = now
        staff.totp_last_step = None
    db.commit()
    return SetupKey(totp.to_base32(secret), totp.otpauth_uri(secret, staff.email, issuer))


def _locked_self(db: Session, viewer: Viewer) -> m.StaffAccount:
    if viewer.staff is None:
        raise AdminError("demo_read_only")
    staff = db.exec(
        select(m.StaffAccount)
        .where(col(m.StaffAccount.id) == viewer.staff.id)
        .with_for_update()
        .execution_options(populate_existing=True)
    ).first()
    if staff is None:
        raise AdminError("not_signed_in")
    return staff


def enable(
    db: Session, settings: Settings, viewer: Viewer, *, code: str, now: datetime
) -> list[str]:
    staff = _locked_self(db, viewer)
    if is_enrolled(staff):
        raise AdminError("two_factor_already_on")
    key = _key(settings)
    started = staff.totp_setup_started_at
    if staff.totp_secret_encrypted is None or started is None or now - started >= PENDING_TTL:
        raise AdminError("two_factor_not_started")
    verdict, step = totp.verify(_secret(key, staff), code, now.timestamp(), None)
    if verdict != "ok":
        raise RequestInvalid("code", "is incorrect")
    staff.totp_enabled_at = now
    staff.totp_last_step = step
    staff.totp_setup_started_at = None
    codes = _new_backup_codes(db, key, _id(staff))
    audit.record(
        db,
        action="auth.two_factor_enabled",
        fingerprint=viewer.fingerprint,
        staff_id=staff.id,
        role=staff.role,
    )
    db.commit()
    return codes


# --- turn off, new backup codes (password + second factor) -----------------------------------


def _confirm(
    db: Session,
    settings: Settings,
    viewer: Viewer,
    *,
    current_password: str,
    code: str | None,
    backup_code: str | None,
    now: datetime,
) -> tuple[m.StaffAccount, bytes, bool]:
    _one_factor(code, backup_code)
    staff = _locked_self(db, viewer)
    if not is_enrolled(staff):
        raise AdminError("two_factor_off")
    key = _key(settings)
    subject = throttle.subject_hash(settings.privacy_hash_key, staff.email)
    throttle.raise_if_locked(db, subject, now)
    password_ok = passwords.verify_password(staff.password_hash, current_password)
    passed, used_backup = (
        _check_second_factor(db, key, staff, code=code, backup_code=backup_code, now=now)
        if password_ok
        else (False, backup_code is not None)
    )
    if not passed:
        # A failed check changed nothing (the step counter and backup codes move only on success).
        audit.record(
            db,
            action="auth.two_factor_failed",
            outcome="bad_credentials",
            fingerprint=viewer.fingerprint,
            staff_id=staff.id,
            role=staff.role,
        )
        throttle.record_failure(db, settings, subject, now)
        db.commit()
        if not password_ok:
            raise RequestInvalid("currentPassword", "is incorrect")
        raise RequestInvalid("backupCode" if backup_code is not None else "code", "is incorrect")
    if used_backup:
        audit.record(
            db,
            action="auth.backup_code_used",
            fingerprint=viewer.fingerprint,
            staff_id=staff.id,
            role=staff.role,
        )
    return staff, key, used_backup


def disable(
    db: Session,
    settings: Settings,
    viewer: Viewer,
    *,
    current_password: str,
    code: str | None,
    backup_code: str | None,
    now: datetime,
) -> None:
    staff, _key_unused, _ = _confirm(
        db,
        settings,
        viewer,
        current_password=current_password,
        code=code,
        backup_code=backup_code,
        now=now,
    )
    _turn_off(db, staff)
    audit.record(
        db,
        action="auth.two_factor_disabled",
        fingerprint=viewer.fingerprint,
        staff_id=staff.id,
        role=staff.role,
    )
    db.commit()


def regenerate_backup_codes(
    db: Session,
    settings: Settings,
    viewer: Viewer,
    *,
    current_password: str,
    code: str | None,
    backup_code: str | None,
    now: datetime,
) -> list[str]:
    staff, key, _ = _confirm(
        db,
        settings,
        viewer,
        current_password=current_password,
        code=code,
        backup_code=backup_code,
        now=now,
    )
    codes = _new_backup_codes(db, key, _id(staff))
    audit.record(
        db,
        action="auth.backup_codes_regenerated",
        fingerprint=viewer.fingerprint,
        staff_id=staff.id,
        role=staff.role,
    )
    db.commit()
    return codes


def _turn_off(db: Session, staff: m.StaffAccount) -> None:
    staff.totp_secret_encrypted = None
    staff.totp_enabled_at = None
    staff.totp_last_step = None
    staff.totp_setup_started_at = None
    staff_id = _id(staff)
    db.exec(delete(m.StaffBackupCode).where(col(m.StaffBackupCode.staff_id) == staff_id))
    db.exec(delete(m.StaffSignInChallenge).where(col(m.StaffSignInChallenge.staff_id) == staff_id))
    db.flush()


# --- reset by an admin or by the operator ----------------------------------------------------


def reset_for_staff(db: Session, actor: Viewer, staff_id: uuid.UUID, now: datetime) -> None:
    if actor.staff_id == staff_id:
        raise AdminError("cannot_reset_self")
    target = db.exec(
        select(m.StaffAccount)
        .where(col(m.StaffAccount.id) == staff_id)
        .with_for_update()
        .execution_options(populate_existing=True)
    ).first()
    if target is None:
        raise NotFound("staff")
    if not is_enrolled(target) and target.totp_secret_encrypted is None:
        raise AdminError("two_factor_off")
    _turn_off(db, target)
    sessions.end_all_for_staff(db, staff_id, "two_factor_reset", now)
    audit.record(
        db,
        action="staff.two_factor_reset",
        fingerprint=actor.fingerprint,
        staff_id=actor.staff_id,
        role=actor.staff.role if actor.staff else None,
        target_type="staff",
        target_id=target.id,
    )
    db.commit()


def operator_reset(db: Session, email: str, now: datetime) -> bool:
    """The command-line reset for when no admin can sign in. False when nothing was on."""
    target = db.exec(
        select(m.StaffAccount)
        .where(func.lower(col(m.StaffAccount.email)) == email.strip().lower())
        .with_for_update()
    ).first()
    if target is None or (not is_enrolled(target) and target.totp_secret_encrypted is None):
        return False
    _turn_off(db, target)
    sessions.end_all_for_staff(db, _id(target), "two_factor_reset", now)
    audit.record(
        db,
        action="staff.two_factor_reset",
        fingerprint=SYSTEM_FINGERPRINT,
        actor_type="system",
        target_type="staff",
        target_id=target.id,
    )
    db.commit()
    return True


# --- the second sign-in step -----------------------------------------------------------------


def create_challenge(
    db: Session, settings: Settings, staff: m.StaffAccount, fp: str, now: datetime
) -> Challenge:
    """Called by ``service.sign_in`` after a correct password for an enrolled account. The caller
    commits. No session exists yet, and the failed-attempt counter is NOT cleared here."""
    token = CHALLENGE_PREFIX + pysecrets.token_urlsafe(32)
    expires_at = now + CHALLENGE_TTL
    db.add(
        m.StaffSignInChallenge(
            staff_id=_id(staff),
            token_hash=tokens.hash_token(settings.session_secret, token),
            created_at=now,
            expires_at=expires_at,
            ip_fingerprint=fp,
        )
    )
    audit.record(
        db,
        action="auth.two_factor_challenge",
        fingerprint=fp,
        target_type="staff",
        target_id=staff.id,
    )
    return Challenge(token, expires_at)


@dataclass(frozen=True)
class Verified:
    staff: m.StaffAccount
    used_backup_code: bool


def verify_challenge(
    db: Session,
    engine: Engine,
    settings: Settings,
    *,
    challenge_token: str,
    code: str | None,
    backup_code: str | None,
    client_ip: str,
    now: datetime,
) -> Verified:
    """Check the second factor. On success the challenge is used up and the caller issues the
    session (``service.finish_sign_in``) in the same transaction."""
    _one_factor(code, backup_code)
    throttle.check_login_ip(engine, settings, client_ip, now)
    fp = fingerprint(settings.privacy_hash_key, client_ip)
    if not challenge_token.startswith(CHALLENGE_PREFIX):
        raise AdminError("challenge_expired")
    row = db.exec(
        select(m.StaffSignInChallenge)
        .where(
            col(m.StaffSignInChallenge.token_hash)
            == tokens.hash_token(settings.session_secret, challenge_token)
        )
        .with_for_update()
    ).first()
    if row is None or row.used_at is not None or now >= row.expires_at:
        raise AdminError("challenge_expired")
    if row.attempts >= MAX_ATTEMPTS:
        raise AdminError("challenge_expired")
    staff = db.exec(
        select(m.StaffAccount)
        .where(col(m.StaffAccount.id) == row.staff_id)
        .with_for_update()
        .execution_options(populate_existing=True)
    ).first()
    changed = (
        staff is None
        or not staff.is_active
        or not is_enrolled(staff)
        or (
            staff.password_changed_at is not None
            and row.created_at is not None
            and staff.password_changed_at > row.created_at
        )
    )
    if staff is None or changed:
        row.used_at = now
        db.commit()
        raise AdminError("challenge_expired")
    subject = throttle.subject_hash(settings.privacy_hash_key, staff.email)
    locked = throttle.locked_for(db, subject, now)
    if locked is not None:
        row.used_at = now
        db.commit()
        raise AdminError("account_locked", retry_after=locked)
    key = _key(settings)
    passed, used_backup = _check_second_factor(
        db, key, staff, code=code, backup_code=backup_code, now=now
    )
    if not passed:
        row.attempts += 1
        audit.record(
            db,
            action="auth.two_factor_failed",
            outcome="bad_credentials",
            fingerprint=fp,
            target_type="staff",
            target_id=staff.id,
        )
        newly_locked = throttle.record_failure(db, settings, subject, now)
        if newly_locked:
            audit.record(db, action="auth.lockout", outcome="locked", fingerprint=fp)
        if newly_locked or row.attempts >= MAX_ATTEMPTS:
            row.used_at = now
        db.commit()
        if newly_locked:
            raise AdminError("account_locked", retry_after=settings.login_lock_minutes * 60)
        if row.attempts >= MAX_ATTEMPTS:
            raise AdminError("challenge_expired")
        raise AdminError("two_factor_failed", extra={"attemptsLeft": MAX_ATTEMPTS - row.attempts})
    row.used_at = now
    throttle.clear(db, subject)
    if used_backup:
        audit.record(
            db,
            action="auth.backup_code_used",
            fingerprint=fp,
            staff_id=staff.id,
            role=staff.role,
        )
    return Verified(staff, used_backup)
