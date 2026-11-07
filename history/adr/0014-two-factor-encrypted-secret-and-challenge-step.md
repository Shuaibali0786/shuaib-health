# ADR-0014: Two-step sign-in with an encrypted authenticator secret and a separate challenge step

- **Status:** Proposed (agent, 2026-11-07; needs owner acceptance)
- **Date:** 2026-11-07
- **Feature:** 011-admin-two-factor
- **Context:**
  - Staff sign in with a password only (ADR-0007). Admins can see patient bookings, so a stolen password is enough to read them.
  - Constitution VI forbids reversible storage of passwords. A time-based code needs the shared secret itself on the server.
  - Serverless rules: no background work; rate limits and lockouts live in Postgres.
  - Free tiers only: no SMS or email provider.

## Decision
- **TOTP (RFC 6238)**: SHA-1, 6 digits, 30 s step, ±1 step. Implemented in the standard library (`app/auth/totp.py`) and tested with the RFC vectors. The last used step is stored, so a code cannot be replayed.
- **Secret at rest**: AES-256-GCM via the `cryptography` package, with a dedicated server key `TWO_FACTOR_KEY` (32 random bytes, base64). The staff id is the associated data, which binds each ciphertext to its account. The ciphertext carries a version prefix (`v1.`) so the key can be rotated later.
- **Backup codes**: 10 random codes of 10 characters each, about 49 bits per code. Only a keyed HMAC-SHA256 of each is stored. Each code works once.
- **Second step**: a correct password for an enrolled account creates a short-lived **challenge** in its own table (5 minutes, 5 attempts, token stored as a hash), not a session. A second call with a code turns the challenge into a session. A password-only token can therefore never pass the session gate.
- **Lockout**: wrong codes count toward the same per-account lockout as wrong passwords. For enrolled accounts a correct password does not reset the counter; only a full sign-in does.
- **Feature switch**: no `TWO_FACTOR_KEY` means enrolment is not offered. An enrolled account then gets 503 at the code step and never a password-only fallback.
- **Recovery**: an admin can reset another person (lost phone). The operator can run `python -m app.auth.create_admin --email … --reset-two-factor`. Both are audited.
- **Website**: the challenge token lives in an httpOnly `__Host-` cookie (5 min), the same pattern as the session cookie.

## Consequences
- Positive: a stolen password alone no longer opens an admin account. No paid service is needed. Works with every common authenticator app. Everything is audited without secrets.
- Negative: one new dependency (`cryptography`). One more secret to manage: losing `TWO_FACTOR_KEY` disables every enrolment, and those staff must be reset. A database migration (0004) is needed.
- Operational: the key must differ per environment and is set by the owner in Vercel. Rotation needs a re-encrypt script (future).

## Alternatives considered
1. **Key derived from `SESSION_SECRET`**: no new secret, but rotating the session secret would lock out every enrolled admin. Rejected.
2. **`pyotp` package**: small, but the algorithm is about 60 lines with published test vectors. Owning it avoids a dependency.
3. **Session with an "MFA pending" flag**: fewer tables, but every policy would have to remember the flag, so one mistake would let a half-signed-in session through. Rejected.
4. **Argon2 for backup codes**: about 1 s for 10 hashes per attempt on serverless, with no gain for random codes. Rejected.
5. **SMS/email codes**: cost money and are weaker (SIM swap). Out of scope.

## References
- specs/011-admin-two-factor/spec.md, plan.md, research.md, data-model.md, contracts/two-factor-api.md
- docs/runbooks/two-factor.md, docs/runbooks/migration-0004.md
