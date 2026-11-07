# Research: Admin two-step sign-in

## R1 TOTP algorithm
- **Decision**: RFC 6238 TOTP over RFC 4226 HOTP with HMAC-SHA1, 6 digits and a 30 s step. Accept steps t-1, t and t+1. Store `totp_last_step` and refuse any step ≤ the last one used. The secret is 20 random bytes (160 bits), shown as unpadded base32. URI: `otpauth://totp/<Issuer>:<email>?secret=…&issuer=<Issuer>&algorithm=SHA1&digits=6&period=30`, where the issuer is the clinic name from settings.
- **Rationale**: SHA-1, 6 digits and 30 s is the only combination every authenticator app supports. The ±1 window covers phone clock drift.
- **Alternatives**: SHA-256 or 8 digits (not supported everywhere); the `pyotp` package (small, but about 60 lines with test vectors is easy to own, so no dependency is needed).

## R2 Encryption of the secret at rest
- **Decision**: AES-256-GCM (`cryptography.hazmat.primitives.ciphers.aead.AESGCM`) with a random 96-bit nonce. Associated data = `staff:<uuid>`, which binds a ciphertext to its account. Stored as `v1.<base64url(nonce‖ciphertext)>`. The key is `TWO_FACTOR_KEY`, a base64 value that decodes to exactly 32 bytes.
- **Rationale**: Authenticated encryption detects tampering. The version prefix allows key rotation later.
- **Alternatives**: Fernet (also from `cryptography`, AES-128-CBC+HMAC, but no associated data); deriving the key from `SESSION_SECRET` (rejected: rotating that secret would lock everyone out); a hand-made HMAC stream cipher (rejected).
- **Dependency note**: `cryptography` ships manylinux wheels for Python 3.12, so the Vercel build needs no compiler. pip-audit already runs in CI.

## R3 Backup codes
- **Decision**: 10 codes of 10 characters from `ABCDEFGHJKMNPQRSTVWXYZ23456789` (30 symbols, no look-alikes, about 49 bits each), shown as `XXXXX-XXXXX`. Input is normalised (upper case, spaces and dashes removed). Stored as `HMAC-SHA256(K_b, code)` in hex, where `K_b = HMAC-SHA256(TWO_FACTOR_KEY, "backup-codes/v1")`. Single use through `used_at`, updated with a conditional `UPDATE … WHERE used_at IS NULL`.
- **Alternatives**: Argon2 per code (slow, see plan); 8-digit numeric codes (lower entropy).

## R4 Second step design
- **Decision**: table `staff_sign_in_challenge`. Its token is `tokens.new_staff_token()`-style random with its own prefix `shc_`, stored as `hash_token(SESSION_SECRET, token)`. It expires 5 minutes after creation, allows 5 attempts, and records `used_at` and the IP fingerprint.
  - Sign-in with a correct password for an enrolled account clears the password throttle as today, writes no session, writes audit `auth.two_factor_challenge` (ok) and returns **202** `{ twoFactorRequired: true, challengeToken, expiresAt }`.
  - Verify: the challenge row is locked `FOR UPDATE`, then expiry, `used_at`, attempts, account active and the code are checked. On success the challenge is marked used, a session is created (same as today's sign-in) and audit `auth.sign_in` is written with outcome `ok`.
  - On failure attempts go up, `throttle.record_failure(subject)` runs (the shared lockout), and audit `auth.two_factor_failed` is written with outcome `bad_credentials`. The 5th failure ends the challenge.
  - A password reset, deactivation or 2FA reset invalidates open challenges (verify re-checks the account).
- **Alternatives**: a session with a `mfa_pending` flag (rejected: every policy would have to remember to check it); a signed stateless challenge (rejected: attempt counting and single use need state).

## R5 Website (BFF)
- **Decision**: `/api/admin/session` POST maps a backend 202 to the cookie `__Host-sh_2fa=<challenge>; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=300`, plus body `{ twoFactorRequired: true }`. New route `/api/admin/session/two-factor` POST `{ code }` or `{ backupCode }` reads that cookie, calls the backend verify, sets the session cookie and clears the challenge cookie. Self-service endpoints go through the existing catch-all proxy allow-list.
- **Rationale**: the constitution forbids tokens that JavaScript can read; this keeps the existing cookie pattern.

## R6 Feature switch and key handling
- `TWO_FACTOR_KEY` is optional in Settings. If it is missing, `GET /admin/auth/two-factor` returns `available: false` and setup returns 409 `two_factor_unavailable`. Enrolled accounts get 503 `two_factor_unavailable` at the verify step: never a password-only fallback. The value is validated as base64 that decodes to exactly 32 bytes; startup fails on a malformed key (not on a missing one).
- **Generating the key** (the owner, locally): `python -c "import secrets,base64;print(base64.b64encode(secrets.token_bytes(32)).decode())"`. Paste it into Vercel → `shuaib-health-api` → Production (and Preview with a *different* value). Never into chat.

## R7 Migration on production
- `0004_two_factor`:
  - adds 4 nullable columns to `staff_account`
  - creates 2 tables with foreign keys `ON DELETE CASCADE` to `staff_account`
  - replaces the check constraints `ck_audit_log_action_valid` and `ck_staff_session_end_reason_valid` with supersets
- Locks: `ALTER TABLE … ADD COLUMN` (nullable, no default) is metadata-only. Dropping and adding a CHECK takes an ACCESS EXCLUSIVE lock and validates existing rows. `audit_log` holds thousands of rows at most, so this takes milliseconds.
- Downgrade: drops the tables and columns, and restores the old constraints with `NOT VALID`, so rows that already use new action names do not block the downgrade (no audit rows are deleted).
