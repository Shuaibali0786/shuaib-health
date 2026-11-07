# Tasks: Admin two-step sign-in (authenticator app)

**Input**: spec.md, plan.md, research.md, data-model.md, contracts/two-factor-api.md
**Tests**: required (security feature; constitution IX; spec SC-002 to SC-005)
**Merge rule**: the PR is NOT merged until Shuaib approves the production migration (spec A-5).

## Phase 1: Setup

- [ ] T001 Add `cryptography` to backend dependencies in `backend/pyproject.toml` and refresh `backend/uv.lock` (`uv lock`), with the reason in the commit message
- [ ] T002 Add optional `two_factor_key: SecretStr | None` to `backend/app/settings.py` (base64 that decodes to exactly 32 bytes, else startup error) and a placeholder entry in `backend/.env.example`

## Phase 2: Foundational (blocks every story)

- [ ] T003 [P] TOTP (RFC 4226/6238, base32, otpauth URI, ±1 step, replay check) in `backend/app/auth/totp.py`, with RFC 6238 SHA-1 vectors in `backend/tests/unit/test_totp.py`
- [ ] T004 [P] AES-256-GCM secret box (associated data `staff:<id>`, `v1.` prefix) and backup-code HMAC/normalise/generate in `backend/app/auth/secretbox.py`, tests in `backend/tests/unit/test_secretbox.py` (round trip, tamper, wrong account, wrong key, code format and entropy alphabet)
- [ ] T005 Models: new staff_account columns, `StaffBackupCode`, `StaffSignInChallenge`, extended `AUDIT_ACTIONS_SQL` and `SESSION_END_REASONS_SQL`, and the `totp_enabled_has_secret` check in `backend/app/models.py`
- [ ] T006 Migration `backend/migrations/versions/0004_two_factor.py` (additive upgrade; downgrade restores the old constraints `NOT VALID`) plus an up/down/up test in `backend/tests/` (migration test pattern)
- [ ] T007 Audit action and outcome literals in `backend/app/auth/audit.py`, end reason `two_factor_reset` in `backend/app/auth/sessions.py`, and policy rows for the new endpoints in `backend/app/auth/policies.py`

## Phase 3: User Story 1, turn on two-step sign-in (P1)

**Independent test**: enrol a test admin; status shows on; the Activity log shows "turned on".

- [ ] T008 [US1] Service `status`, `start_setup` (password re-confirm, admin role, key present, refuse while `must_change_password`, replace a pending secret older than 15 min) and `enable` (code check, 10 backup codes, audit `auth.two_factor_enabled`) in `backend/app/auth/two_factor.py`
- [ ] T009 [US1] Schemas in `backend/app/command_centre/schemas.py` and endpoints `GET /admin/auth/two-factor`, `POST …/setup`, `POST …/enable` in `backend/app/routers/admin_auth.py`
- [ ] T010 [P] [US1] API tests in `backend/tests/api/test_two_factor_setup.py`: admin only, wrong password, no key (409), wrong code, enable, codes shown once and stored hashed, audit row, demo read-only
- [ ] T011 [US1] Website: allow-list entries in `frontend/src/admin/lib/bffRoutes.ts`; zod schemas in `frontend/src/admin/lib/schemas.ts`; Security page `frontend/src/app/(admin)/admin/(app)/account/security/page.tsx` with `frontend/src/admin/account/TwoFactorCard.tsx` (QR through `src/lib/booking/qr.ts`, setup key, code input, backup codes with copy/print, "I saved them" checkbox); nav link from the account menu
- [ ] T012 [P] [US1] Vitest for TwoFactorCard and the allow-list in `frontend/tests/unit/admin-two-factor.test.tsx`

## Phase 4: User Story 2, signing in with a code (P1)

**Independent test**: an enrolled account gets no session from the password alone; password plus code signs in.

- [ ] T013 [US2] `service.sign_in` returns `Challenge` for enrolled accounts (no session; audit `auth.two_factor_challenge`); `verify_challenge` (row lock, expiry, attempts ≤ 5, account active, TOTP replay guard or backup code single-use `UPDATE … WHERE used_at IS NULL`, shared lockout via `throttle.record_failure`, audit `auth.two_factor_failed` / `auth.backup_code_used` / `auth.sign_in`) in `backend/app/auth/service.py` + `backend/app/auth/two_factor.py`
- [ ] T014 [US2] Sign-in 202 response and `POST /admin/auth/sign-in/two-factor` (with the per-IP sign-in limiter) in `backend/app/routers/admin_auth.py`
- [ ] T015 [P] [US2] API tests in `backend/tests/api/test_two_factor_sign_in.py`: password alone gives no session; good code; t±1; t±2 refused; replay refused; 5 failures end the challenge; lockout shared with passwords; expiry; deactivated mid-challenge; backup code once; missing key gives 503 and never a password-only session; no secret or code in logs (caplog)
- [ ] T016 [US2] Website: `/api/admin/session` maps 202 to the `__Host-sh_2fa` cookie; new route `frontend/src/app/api/admin/session/two-factor/route.ts`; `frontend/src/admin/auth/TwoFactorStep.tsx` (one-time-code input, backup-code toggle, attempts left, "start again") wired into `SignInForm.tsx`
- [ ] T017 [P] [US2] Vitest for the two routes (cookie flags, the token never in the body, Origin check) and the step component in `frontend/tests/unit/admin-two-factor-signin.test.tsx`
- [ ] T018 [US2] Mock API support for 2FA (an enrolled fixture admin, deterministic codes) in `frontend/tests/mock-api/server.mjs`, and Playwright `frontend/tests/e2e/admin-two-factor.spec.ts` (sign in with a code on admin-desktop and admin-mobile; enrol; staff reset; axe on the code step, the Security page and the reset dialog)

## Phase 5: User Story 3, lost phone (P2)

- [ ] T019 [US3] `reset_for_staff` (admin, not self; clears secret and codes, ends sessions with `two_factor_reset`, audit `staff.two_factor_reset`) and the endpoint `POST /admin/staff/{staffId}/two-factor/reset` in `backend/app/auth/two_factor.py` + `backend/app/routers/admin_staff.py`; `StaffOut.two_factor_enabled`
- [ ] T020 [US3] Operator reset `--reset-two-factor <email>` in `backend/app/auth/create_admin.py` (audit `actor_type=system`)
- [ ] T021 [P] [US3] Tests in `backend/tests/api/test_two_factor_reset.py` (admin reset, self refused, receptionist refused, sessions ended, operator reset)
- [ ] T022 [US3] Website: status chip and "Reset two-step sign-in" (confirm dialog) in `frontend/src/admin/staff/`; allow-list entry; Vitest

## Phase 6: User Story 4, turn off and new backup codes (P3)

- [ ] T023 [US4] `disable` and `regenerate_backup_codes` (password + code or backup code) plus endpoints, in `backend/app/auth/two_factor.py` + `backend/app/routers/admin_auth.py`
- [ ] T024 [P] [US4] Tests in `backend/tests/api/test_two_factor_manage.py`
- [ ] T025 [US4] Website: turn-off and new-codes forms in `TwoFactorCard.tsx`; Vitest

## Phase 7: Polish & cross-cutting

- [ ] T026 Activity labels for the new actions in the website Activity screen, and the CSV-free display (no codes ever shown)
- [ ] T027 Daily maintenance deletes expired challenges in `backend/app/ops/` (existing purge job), with a test
- [ ] T028 Contract: add the endpoints to `specs/006-clinic-command-centre/contracts/command-centre-api.openapi.yaml` (or the file the admin contract test reads); regenerate website types if generated; `test_admin_contract.py`, `test_route_policies.py` and `test_auth_matrix.py` green
- [ ] T029 ADR-0014 "Two-step sign-in: encrypted TOTP secret with a dedicated key and a challenge step" (Proposed) in `history/adr/`
- [ ] T030 Runbooks: `docs/runbooks/two-factor.md` (generate key, set it in Vercel, enrol, lost phone, operator reset, key loss) and `docs/runbooks/migration-0004.md` (exact production steps, restore point, rollback)
- [ ] T031 Full suites, one at a time: backend pytest + mypy + ruff; frontend typecheck, lint, vitest, Playwright admin projects; record results in `specs/011-admin-two-factor/results.md`
- [ ] T032 PR (do NOT merge); report the migration steps and risk to Shuaib

## Dependencies

- Setup → Foundational → US1 → US2 (US2 needs an enrolled account) → US3, US4 (independent of each other) → Polish.
- [P] tasks touch different files and can run in parallel within their phase.

## Parallel examples

- Phase 2: T003 and T004 together.
- US1: T010 (API tests) alongside T011 (website).
- US3/US4: T021 and T024 together.

## Implementation strategy

MVP = US1 + US2 (enrol and sign in with a code). US3 (recovery) must ship in the **same PR**, because 2FA without a recovery path is unsafe to release. US4 completes the feature.
