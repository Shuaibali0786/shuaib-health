"""Who may call each Command Centre endpoint (ADR-0007), transcribed row by row from
specs/006-clinic-command-centre/contracts/auth-matrix.md.

Every route under ``/api/v1/admin`` must appear here and carry ``require_viewer(policy)`` with the
same policy; ``tests/api/test_route_policies.py`` fails otherwise. Keys are ``(METHOD, path)`` with
the path relative to the API prefix, exactly as the contract writes it.
"""

from enum import StrEnum


class Policy(StrEnum):
    PUBLIC_PROXY = "PUBLIC_PROXY"  # proxy secret only (sign-in, demo start)
    SELF = "SELF"  # any signed-in viewer, staff or demo; may still have to change the password
    SELF_STAFF = "SELF_STAFF"  # staff only (a demo viewer gets demo_read_only)
    READ = "READ"  # staff or demo; refused while the password must be changed
    READ_ADMIN = "READ_ADMIN"  # admins (and demo, which is synthetic)
    WRITE = "WRITE"  # staff only
    WRITE_ADMIN = "WRITE_ADMIN"  # admins only


ENDPOINT_POLICIES: dict[tuple[str, str], Policy] = {
    ("POST", "/admin/auth/sign-in"): Policy.PUBLIC_PROXY,
    ("POST", "/admin/demo/start"): Policy.PUBLIC_PROXY,
    ("GET", "/admin/auth/me"): Policy.SELF,
    ("POST", "/admin/auth/sign-out"): Policy.SELF,
    ("POST", "/admin/auth/change-password"): Policy.SELF_STAFF,
    ("GET", "/admin/lookups"): Policy.READ,
    ("GET", "/admin/overview"): Policy.READ,
    ("POST", "/admin/bookings/search"): Policy.READ,
    ("GET", "/admin/bookings/{reference}"): Policy.READ,
    ("POST", "/admin/bookings/{reference}/reveal-phone"): Policy.READ,
    ("POST", "/admin/bookings/{reference}/status"): Policy.WRITE,
    ("POST", "/admin/bookings/{reference}/status/undo"): Policy.WRITE,
    ("GET", "/admin/insights"): Policy.READ,
    ("GET", "/admin/doctors-today"): Policy.READ,
    ("GET", "/admin/activity"): Policy.READ_ADMIN,
    ("GET", "/admin/staff"): Policy.READ_ADMIN,
    ("POST", "/admin/staff"): Policy.WRITE_ADMIN,
    ("POST", "/admin/staff/{staffId}/reset-password"): Policy.WRITE_ADMIN,
    ("PATCH", "/admin/staff/{staffId}"): Policy.WRITE_ADMIN,
}

# Policies that need a signed-in session, and those that change state (CSRF applies).
SESSION_POLICIES = frozenset(Policy) - {Policy.PUBLIC_PROXY}
ADMIN_ONLY_POLICIES = frozenset({Policy.WRITE_ADMIN})
STAFF_ONLY_POLICIES = frozenset({Policy.SELF_STAFF, Policy.WRITE, Policy.WRITE_ADMIN})
PASSWORD_EXEMPT_POLICIES = frozenset({Policy.PUBLIC_PROXY, Policy.SELF, Policy.SELF_STAFF})
