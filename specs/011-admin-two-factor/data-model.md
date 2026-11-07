# Data model: Admin two-step sign-in (migration `0004_two_factor`)

## staff_account (new columns, all nullable)
| Column | Type | Meaning |
|---|---|---|
| `totp_secret_encrypted` | `varchar(200)` | `v1.<b64url(nonce‖ct)>`. Set at setup; enrolment is complete only when `totp_enabled_at` is set |
| `totp_enabled_at` | `timestamptz` | When 2FA was turned on. `NULL` = off |
| `totp_last_step` | `bigint` | The last accepted 30 s step (replay guard) |
| `totp_setup_started_at` | `timestamptz` | When a pending setup began (a pending secret older than 15 min is replaced) |

Constraint: `ck_staff_account_totp_enabled_has_secret`: `totp_enabled_at IS NULL OR totp_secret_encrypted IS NOT NULL`.

## staff_backup_code (new)
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `staff_id` | uuid FK → staff_account ON DELETE CASCADE | indexed |
| `code_hash` | `char(64)` | HMAC-SHA256 hex; unique together with `staff_id` |
| `created_at` | timestamptz default now() | |
| `used_at` | timestamptz null | single use |

## staff_sign_in_challenge (new)
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `staff_id` | uuid FK → staff_account ON DELETE CASCADE | |
| `token_hash` | `char(64)` unique | hash of the challenge token |
| `created_at` | timestamptz default now() | |
| `expires_at` | timestamptz | check: `expires_at > created_at` |
| `attempts` | smallint default 0 | check: `0 ≤ attempts ≤ 5` |
| `used_at` | timestamptz null | |
| `ip_fingerprint` | `char(64)` | the same HMAC fingerprint as sessions |

Housekeeping: rows past their expiry are deleted by the existing daily maintenance job (the same pattern as login throttle cleanup), which keeps the table tiny.

## Constraint changes
- `ck_audit_log_action_valid`: the current list **plus**:
  - `auth.two_factor_challenge`
  - `auth.two_factor_failed`
  - `auth.two_factor_enabled`
  - `auth.two_factor_disabled`
  - `auth.backup_code_used`
  - `auth.backup_codes_regenerated`
  - `staff.two_factor_reset`
- `ck_staff_session_end_reason_valid`: the current list **plus** `two_factor_reset`.

## State transitions (per account)
```
off --setup(password)--> pending (secret set, enabled_at NULL)
pending --enable(code)--> on (enabled_at set, 10 backup codes)
pending --setup again (>15 min or explicit)--> pending (new secret)
on --disable(password+code)--> off (secret, codes cleared)
on --admin reset / operator reset--> off (secret, codes cleared, sessions ended)
on --regenerate(password+code)--> on (old codes deleted, 10 new)
```
