# Contract: two-step sign-in API (under `/api/v1`)

All responses carry `Cache-Control: no-store`. Errors use the existing `ErrorResponse` envelope. Policies are those in `app/auth/policies.py`.

| Method & path | Policy | Body | Success | Errors |
|---|---|---|---|---|
| `POST /admin/auth/sign-in` (changed) | PUBLIC_PROXY | `{email, password}` | **200** `SessionIssued` (no 2FA), or **202** `TwoFactorChallenge {twoFactorRequired: true, challengeToken, expiresAt}` | unchanged (401 `sign_in_failed`, 429 `account_locked` or rate limit) |
| `POST /admin/auth/sign-in/two-factor` | PUBLIC_PROXY | `{challengeToken, code?: "123456", backupCode?: "ABCDE-FGHJK"}` (exactly one of code/backupCode) | **200** `SessionIssued` | 401 `two_factor_failed` (wrong code; `attemptsLeft`), 401 `challenge_expired` (expired, used or 5 failures), 429 `account_locked` or rate limit, 422, 503 `two_factor_unavailable` |
| `GET /admin/auth/two-factor` | SELF_STAFF | none | **200** `{available, enabled, enabledAt?, backupCodesLeft?, canEnrol}` | 401 |
| `POST /admin/auth/two-factor/setup` | SELF_STAFF (admin role) | `{currentPassword}` | **200** `{secret, otpauthUri}` (secret base32, shown once) | 403 `two_factor_admins_only`, 409 `two_factor_unavailable` / `two_factor_already_on` / `password_change_required`, 422 `currentPassword is incorrect` |
| `POST /admin/auth/two-factor/enable` | SELF_STAFF | `{code}` | **200** `{backupCodes: string[10]}` | 409 `two_factor_not_started`, 422 `code is incorrect` |
| `POST /admin/auth/two-factor/disable` | SELF_STAFF | `{currentPassword, code? , backupCode?}` | **204** | 409 `two_factor_off`, 422 |
| `POST /admin/auth/two-factor/backup-codes` | SELF_STAFF | `{currentPassword, code?, backupCode?}` | **200** `{backupCodes: string[10]}` | 409, 422 |
| `POST /admin/staff/{staffId}/two-factor/reset` | WRITE_ADMIN | none | **204** | 404, 409 `two_factor_off`, 409 `cannot_reset_self` |
| `GET /admin/staff` (changed) | READ_ADMIN | none | each `StaffOut` gains `twoFactorEnabled: boolean` | unchanged |

Rules:
- A demo viewer gets `demo_read_only` (403) on every write, through the existing policy behaviour.
- The sign-in rate limit per IP also covers `sign-in/two-factor`.
- `challengeToken` and `secret` never reach browser JavaScript: the website keeps the challenge in an httpOnly cookie, and the setup secret is shown to the signed-in admin on purpose so they can type it into the app.
- Activity log actions:
  - `auth.two_factor_challenge`, `auth.two_factor_failed`
  - `auth.two_factor_enabled`, `auth.two_factor_disabled`
  - `auth.backup_code_used`, `auth.backup_codes_regenerated`
  - `staff.two_factor_reset`; the operator reset is the same action with `actor_type=system`

## Website routes (BFF)
| Route | Notes |
|---|---|
| `POST /api/admin/session` | A 202 from the backend sets `__Host-sh_2fa` (Max-Age 300) and returns `{twoFactorRequired: true}` |
| `POST /api/admin/session/two-factor` | `{code}` or `{backupCode}`. Reads `__Host-sh_2fa`; on 200 sets the session cookie and clears the challenge cookie |
| `GET/POST /api/admin/auth/two-factor[...]`, `POST /api/admin/staff/{id}/two-factor/reset` | Added to the catch-all allow-list with small body limits |
