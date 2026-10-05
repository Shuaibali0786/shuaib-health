# ADR-0007: Staff Authentication via Opaque Server-Side Sessions and a Policy Table

> **Scope**: Document decision clusters, not individual technology choices. Group related decisions that work together (e.g., "Frontend Stack" not separate ADRs for framework, styling, deployment).

- **Status:** Accepted
- **Date:** 2026-10-05
- **Feature:** 006-clinic-command-centre
- **Context:**
  - Feature 006 adds the first staff sign-in (roles `admin` and `receptionist`) and a public read-only demo.
  - The spec requires immediate revocation: sign-out, password reset, deactivation, a cap of 3 active sessions per person, a 30-minute idle timeout and a 12-hour absolute limit.
  - Constitution 1.0.0 Principle VI said "Sessions use a JWT". It was amended to 1.0.1 ("a JWT or an opaque server-side session token") on the strength of this decision.
  - The browser never talks to the backend directly (same-origin proxy, ADR-0006). The website server is the only backend client, and it presents the proxy secret.
  - SC-004 asks for proof that 100% of admin endpoints enforce roles on the server. Hiding a button in the UI is never the protection (FR-009).

## Decision

- **Session token**: 256-bit random token (`secrets.token_urlsafe(32)`, `cs_` prefix), returned once to the website server. The database stores only `HMAC-SHA256(SESSION_SECRET, token)` in `staff_session`.
- **Cookie**: `__Host-cc_session`, `Secure; HttpOnly; SameSite=Strict; Path=/`, with no `Max-Age`. The website server forwards it to the backend as `X-Session-Token`.
- **Lifetimes**: idle 30 min (slid at most once per 60 s), absolute 12 h, both checked on every request. A new token on every sign-in (no fixation). Sign-in locks the staff row and ends the oldest sessions beyond 2.
- **Revocation**: sign-out, password change, admin reset and deactivation set `ended_at` and `end_reason` in the same transaction.
- **CSRF**: three layers on every state-changing request: SameSite=Strict, the website's `Origin` + `Sec-Fetch-Site` guard, and a synchronizer token `HMAC(SESSION_SECRET, "csrf:" + session_id)` sent as `X-CSRF-Token` and compared in constant time.
- **Passwords**: Argon2id via `argon2-cffi` (`t=3, m=64 MiB, p=1`), rehash on sign-in if parameters change. Policy: 12–128 chars, not based on the email, not in a bundled 10k common-password list. A dummy verify keeps unknown-email timing equal.
- **Throttling**: per typed email (HMAC-keyed `login_throttle`, 5 failures / 15 min → 15-min lock; unknown emails lock the same way) plus per-IP Postgres limits reused from 005 (20 sign-ins / 15 min, 10 demo starts / hour). Every other failure is a single generic `401 sign_in_failed`.
- **Authorization**: one dependency `require_viewer(Policy)` with policies `READ`, `READ_ADMIN`, `WRITE`, `WRITE_ADMIN` and `SELF`. Every admin route declares its policy and is listed in `ENDPOINT_POLICIES`. A pytest introspection test walks `app.routes` and fails on any unlisted or unguarded `/api/v1/admin` route. The auth-matrix test is generated from the same table. `must_change_password` narrows a viewer to `SELF`.
- **Secrets**: new `SESSION_SECRET` (≥ 32 chars, fail fast), separate from `PRIVACY_HASH_KEY`. `BOOKING_PROXY_SECRET` keeps its name and now authorises all website-server → backend calls.
- **Bootstrap**: the first admin is created only by the `app.auth.create_admin` CLI. The seed never creates staff.

## Consequences

### Positive

- Revocation is immediate and exact: one row update ends a session everywhere.
- A database leak alone cannot forge a session lookup (keyed HMAC), and no token is ever readable by JavaScript.
- An endpoint added without a policy fails CI, so SC-004 is proven by construction, not by review.
- No new infrastructure: sessions, throttles and limits all live in the existing Neon Postgres.
- Lockout cannot be used to discover which emails have accounts.

### Negative

- One indexed database lookup per admin request (trivial at ≤ 20 staff, but it is a dependency on the database being up).
- Rotating `SESSION_SECRET` signs every staff member out. This is documented.
- New dependency `argon2-cffi` and a new secret to provision on both hosts.
- Per-email lockout lets an attacker lock a known staff email for 15 minutes (accepted; staff can still be helped by an admin, and the IP limit slows this down).
- The policy table and route decorators are two places to update per endpoint; the introspection test keeps them in step.

## Alternatives Considered

- **JWT in an httpOnly cookie** (constitution 1.0.0 wording): revocation would still need a session or denylist table, adding signing-key rotation and clock-skew concerns with no benefit. Rejected.
- **Cookie set by the backend directly**: needs the browser to call the backend origin, which breaks the same-origin proxy rule. Rejected.
- **Plain SHA-256 token hash**: acceptable for high-entropy tokens, but HMAC costs nothing and adds defence in depth. Rejected.
- **Double-submit CSRF cookie** or **Origin-only checks**: weaker against cookie injection, or broken by privacy proxies that strip `Origin`. Rejected for the session-bound synchronizer token.
- **Per-route role checks without a central table**: easy to forget on a new endpoint and impossible to prove complete. Rejected.
- **CAPTCHA or progressive delays** for sign-in: third-party dependency and poor accessibility, or hard to test. Rejected.

## References

- Feature Spec: [specs/006-clinic-command-centre/spec.md](../../specs/006-clinic-command-centre/spec.md) (FR-001–009, SC-004)
- Implementation Plan: [specs/006-clinic-command-centre/plan.md](../../specs/006-clinic-command-centre/plan.md) (Key Decisions 1, 2)
- Research: [research.md R1–R6, R15](../../specs/006-clinic-command-centre/research.md); [contracts/auth-matrix.md](../../specs/006-clinic-command-centre/contracts/auth-matrix.md)
- Constitution: Principle VI, amended 1.0.0 → 1.0.1 on 2026-10-05
- Related ADRs: ADR-0003 (security baseline), ADR-0006 (proxy trust and Postgres rate limiting)
- Evaluator Evidence: [history/prompts/006-clinic-command-centre/004-constitution-adrs-design-preview.misc.prompt.md](../prompts/006-clinic-command-centre/004-constitution-adrs-design-preview.misc.prompt.md)
