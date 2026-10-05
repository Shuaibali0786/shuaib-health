"""Automatic deletion of demo data (FR-051, FR-054): bookings after the appointment, audit later."""

import logging
from datetime import datetime, timedelta
from typing import Any

from sqlalchemy import Connection, text

BATCH_SIZE = 200

logger = logging.getLogger("app.booking")

# Table and column names are fixed constants here, never user input.
_DELETE_APPOINTMENTS = text(
    "DELETE FROM appointment WHERE ctid IN "
    "(SELECT ctid FROM appointment WHERE ends_at < :cutoff LIMIT :batch)"
)
_DELETE_AUDIT = text(
    "DELETE FROM audit_log WHERE ctid IN "
    "(SELECT ctid FROM audit_log WHERE occurred_at < :cutoff LIMIT :batch)"
)


def _delete_batches(conn: Connection, statement: Any, cutoff: datetime, limit: int | None) -> int:
    """Delete in batches; with ``limit`` stop after that many rows, else run until none are left."""
    total = 0
    while limit is None or total < limit:
        batch = BATCH_SIZE if limit is None else min(BATCH_SIZE, limit - total)
        deleted = conn.execute(statement, {"cutoff": cutoff, "batch": batch}).rowcount
        total += deleted
        if deleted < batch:
            break
    return total


def purge_demo_bookings(
    conn: Connection,
    *,
    now: datetime,
    after_days: int,
    audit_after_days: int,
    limit: int | None = BATCH_SIZE,
) -> int:
    """Delete bookings that ended more than ``after_days`` ago, then old audit rows.

    Returns the number of bookings deleted. ``limit`` caps the rows removed per table in one call;
    ``None`` removes everything due. The caller owns the transaction.
    """
    deleted = _delete_batches(conn, _DELETE_APPOINTMENTS, now - timedelta(days=after_days), limit)
    _delete_batches(conn, _DELETE_AUDIT, now - timedelta(days=audit_after_days), limit)
    logger.info("purge", extra={"event": "purge", "deleted": deleted})
    return deleted
