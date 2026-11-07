# Implementation Plan: Admin two-step sign-in (authenticator app)

**Branch**: `011-admin-two-factor` | **Date**: 2026-11-07 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/011-admin-two-factor/spec.md`

## Summary

TOTP (RFC 6238, SHA-1, 6 digits, 30 s, ±1 step) for staff accounts, offered to admins.
- **Secret storage**: the per-account secret is AES-256-GCM encrypted with a new server key `TWO_FACTOR_KEY`, with the staff id as associated data.
- **Backup codes**: 10 single-use codes, stored as keyed HMAC-SHA256.
- **Sign-in**: a correct password for an enrolled account returns a short-lived **challenge** (202) instead of a session. A second call with the challenge and a code (or backup code) issues the session. Replay is blocked by storing the last used time step.
- **Activity log**: every event goes to `audit_log` under new action names.
- **Website**: the challenge token is kept in its own `__Host-` httpOnly cookie, never in browser JavaScript.
- **Migration**: one additive migration `0004_two_factor`. It is **not** run on production and the PR is **not** merged until Shuaib approves.

## Technical Context

**Language/Version**: Python 3.12 (backend), TypeScript strict / Next.js 16.4 (frontend)
**Primary Dependencies**: FastAPI, SQLModel, Alembic. **New: `cryptography`** (AES-GCM only; see research R2). The frontend adds no new dependency: the QR code uses the existing in-house encoder `src/lib/booking/qr.ts`.
**Storage**: Neon Postgres; migration `0004_two_factor` (additive). See [data-model.md](data-model.md).
**Testing**: pytest (unit: TOTP vectors, crypto, codes; API: flows, matrix, audit, log safety; migration up/down), Vitest (forms, BFF routes), Playwright (admin sign-in with code, enrol, staff reset, axe).
**Target Platform**: Vercel Python Functions (API) and Vercel Next.js (website), `sin1`.
**Project Type**: web (backend + frontend)
**Performance Goals**: code check under 50 ms server time. No Argon2 on the code path; Argon2 is used only for the password re-confirm.
**Constraints**: serverless (no background work); no secrets in logs; free tier; works on phones; WCAG 2.2 AA.
**Scale/Scope**: a handful of staff per clinic; 10 backup codes per account.

## Constitution Check

- [x] I. Honesty: no claims. The demo keeps its sample staff; the demo viewer sees the 2FA status as sample data.
- [x] II. Privacy: roles enforced server-side (policies table); every event audited; no code, secret or password in logs (log-safety test); rate limits: 5 wrong codes per challenge, wrong codes feed the existing login lockout, and the existing per-IP sign-in limiter covers the verify call.
- [x] III. Server truth: all checks are on the server; time comes from the injected clock.
- [x] IV. API-first: new endpoints in the admin OpenAPI contract ([contracts/](contracts/)); the BFF allow-list is updated.
- [x] V. Resilience: the frontend build does not depend on the backend.
- [x] VI. Security:
  - Argon2 is unchanged for passwords.
  - Session and challenge tokens stay opaque, and only their hashes are stored.
  - Cookies are `__Host-`, httpOnly, Secure and SameSite=Strict.
  - CSRF and Origin checks apply to the new routes.
  - The TOTP secret is stored **encrypted**, which is reversible by design (see Complexity Tracking).
- [x] VII. Databases: one Alembic migration with a tested downgrade; applied with the direct URL; no production run without approval.
- [x] VIII. Design/a11y: tokens only; the code input has `inputmode="numeric"` and `autocomplete="one-time-code"`; axe on the new screens.
- [x] IX. Quality: unit tests for the TOTP, crypto and code logic; Playwright for the sign-in-with-code flow; strict types.
- [x] X. Build order: staff app (phase 3 work) on a deployed product; no later-phase work.
- [x] XI. Safe change: own branch; additive migration; feature switch (`TWO_FACTOR_KEY` missing means no enrolment offered); no old test loosened; draft PR, **not merged** before migration approval.

## Project Structure

### Documentation (this feature)

```text
specs/011-admin-two-factor/
├── plan.md, research.md, data-model.md, quickstart.md
├── contracts/two-factor-api.md
├── checklists/requirements.md
└── tasks.md (/sp.tasks)
```

### Source Code

```text
backend/
├── app/auth/totp.py            # RFC 4226/6238 codes, base32 secrets, otpauth URI (stdlib only)
├── app/auth/secretbox.py       # AES-GCM encrypt/decrypt with TWO_FACTOR_KEY, HMAC for backup codes
├── app/auth/two_factor.py      # setup, enable, disable, regenerate, verify challenge, admin reset
├── app/auth/service.py         # sign_in returns Issued | Challenge
├── app/auth/audit.py, events.py, sessions.py   # new action names, end reason
├── app/auth/policies.py        # new endpoints
├── app/routers/admin_auth.py   # /admin/auth/two-factor/*, sign-in 202
├── app/routers/admin_staff.py  # /admin/staff/{id}/two-factor/reset; StaffOut.twoFactorEnabled
├── app/command_centre/schemas.py
├── app/models.py               # columns + StaffBackupCode + StaffSignInChallenge + constraint lists
├── app/settings.py             # TWO_FACTOR_KEY (optional SecretStr, >= 32 bytes base64)
├── app/auth/create_admin.py    # --reset-two-factor operator command
├── migrations/versions/0004_two_factor.py
└── tests/ (unit + api + migration)

frontend/
├── src/app/api/admin/session/route.ts            # 202 → challenge cookie, { twoFactorRequired: true }
├── src/app/api/admin/session/two-factor/route.ts # POST code → session cookie
├── src/admin/lib/bffRoutes.ts                    # allow-list: two-factor endpoints, staff reset
├── src/admin/auth/SignInForm.tsx + TwoFactorStep.tsx
├── src/app/(admin)/admin/(app)/account/security/page.tsx + src/admin/account/TwoFactorCard.tsx
├── src/admin/staff/*                             # status chip + reset action
├── src/admin/activity/labels                     # new action labels
└── tests/unit + tests/e2e (admin projects)
```

**Structure Decision**: The existing backend/frontend layout. 2FA logic lives in `app/auth/` next to sessions and passwords.

## Key decisions (see research.md)

1. **TOTP in-house, stdlib only** (about 60 lines, tested with the RFC 6238 vectors). This avoids a dependency for a small, well-specified algorithm.
2. **AES-256-GCM via `cryptography`** for the secret at rest. There is no safe stdlib option, and a home-made cipher is ruled out.
3. **Separate key `TWO_FACTOR_KEY`**, not derived from `SESSION_SECRET`. Rotating the session secret must not lock admins out. If the key is missing, enrolment is not offered (the feature switch). An enrolled account then cannot finish sign-in; there is never a password-only fallback.
4. **Challenge rather than a half-session**: a separate table and token, so a password-only token can never pass `require_viewer`.
5. **Backup codes as HMAC-SHA256** (keyed with an HKDF-style derivation of `TWO_FACTOR_KEY`). They are 50-bit random values, not human passwords, and checking 10 of them with Argon2 on serverless would be slow.
6. **Audit**: new actions in the `action_valid` check constraint (drop and recreate in the migration). The existing outcomes are reused (`ok`, `bad_credentials`, `locked`, `refused`).

📋 Architectural decision detected: TOTP secret encryption with a dedicated server key plus the challenge-based second step. Document it? Run `/sp.adr two-factor-secret-storage-and-challenge` (an ADR is proposed in this PR as ADR-0014, status Proposed, for Shuaib to accept).

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Reversible (encrypted) storage of the TOTP secret, next to "no reversible storage" for passwords | The server must recompute codes, so it needs the secret itself | A hash cannot produce codes. Plain storage would expose every admin's second factor if the database leaked |
| Backup codes hashed with HMAC, not Argon2 | 50-bit random codes resist guessing with a keyed hash. Argon2 ×10 per attempt on serverless is slow and costly | Argon2 would add about 0.5 to 1 s per backup-code attempt with no real gain for random codes |
| New dependency `cryptography` | Authenticated encryption is needed (FR-012) | Python's stdlib has no AES. A home-made cipher is unsafe |
