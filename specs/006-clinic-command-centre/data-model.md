# Data Model: Clinic Command Centre

**Feature**: 006-clinic-command-centre | **Migration**: `backend/migrations/versions/0003_command_centre.py` (down revision `0002_booking`)

Conventions follow `specs/005-appointment-booking/data-model.md`: names from the SQLModel naming convention; UUID PKs from `gen_random_uuid()`; `created_at`/`updated_at`; every instant is `timestamptz` (UTC at rest, aware datetimes only); no personal data in any column not listed as such; the clinic time zone (`clinic_settings.timezone`, Asia/Karachi) is applied in code or as a bound SQL parameter, never from the session time zone (005 R5).

## 1. `staff_account` (new)

| Column | Type | Rules |
|---|---|---|
| id, created_at, updated_at | | standard |
| email | varchar(254) | stored lower-cased and trimmed; `UNIQUE` index on `email` (case-insensitive by construction); simple format check in app |
| display_name | varchar(60) | 2–60 chars; shown in the UI and the Activity feed (staff name, not patient data) |
| role | varchar(16) | `CHECK (role IN ('admin','receptionist'))` |
| is_active | boolean | default true |
| password_hash | varchar(255) | Argon2id PHC string; `CHECK (password_hash LIKE '$argon2id$%')` |
| must_change_password | boolean | default false; true after an admin reset |
| password_changed_at | timestamptz | |
| last_sign_in_at | timestamptz NULL | |
| created_by_id | uuid NULL FK → staff_account `ON DELETE RESTRICT` | NULL for the CLI-created first admin |

- Staff rows are **never deleted** (deactivated only), so audit references stay valid.
- **Last active admin invariant**: deactivating or demoting an admin runs inside a transaction that locks all active admin rows (`SELECT … FOR UPDATE`) and refuses (`409 last_admin`) if it would leave zero. Tested with two concurrent demotions.
- The seed never writes this table (R15).

## 2. `staff_session` (new)

| Column | Type | Rules |
|---|---|---|
| id | uuid PK | |
| staff_id | uuid FK → staff_account `ON DELETE RESTRICT` | index `(staff_id) WHERE ended_at IS NULL` |
| token_hash | char(64) | `UNIQUE`; hex HMAC-SHA256(`SESSION_SECRET`, token). The token itself is never stored |
| created_at | timestamptz | |
| last_seen_at | timestamptz | updated at most once per 60 s |
| idle_expires_at | timestamptz | `last_seen_at + 30 min` |
| absolute_expires_at | timestamptz | `created_at + 12 h`; `CHECK (absolute_expires_at > created_at)` |
| ended_at | timestamptz NULL | |
| end_reason | varchar(20) NULL | `CHECK (end_reason IN ('sign_out','idle','absolute','evicted','password_changed','password_reset','deactivated','replaced'))` |
| ip_fingerprint | char(16) | HMAC of client IP (005 `privacy.py`), never the raw IP |

**Valid session** ⇔ `ended_at IS NULL AND now < idle_expires_at AND now < absolute_expires_at` and the staff row is active. An expired session found on lookup is ended with reason `idle`/`absolute` and an `auth.session_expired` audit row is written (once).

**State**: `active → ended(reason)`; terminal. At most 3 active per staff (oldest → `evicted`).

## 3. `demo_session` (new)

| Column | Type | Rules |
|---|---|---|
| id | uuid PK | |
| token_hash | char(64) | `UNIQUE`; same HMAC scheme, token prefix `cd_` |
| demo_date | date | Karachi date when the demo started; the dataset key |
| created_at | timestamptz | |
| expires_at | timestamptz | `created_at + 2 h` |
| ip_fingerprint | char(16) | HMAC of client IP |

No foreign key to anything; no link to `staff_session`. Purged 1 day after expiry. No audit rows are written for demo sessions (only the structured `demo.started` log counter, R16).

## 4. `login_throttle` (new)

| Column | Type | Rules |
|---|---|---|
| subject_hash | char(64) PK | HMAC(`PRIVACY_HASH_KEY`, `"login:" + lower(email)`) — works for unknown emails |
| failed_count | smallint | `CHECK (failed_count >= 1)` |
| window_started_at | timestamptz | start of the current 15-min failure window |
| locked_until | timestamptz NULL | set at the 5th failure in the window |
| expires_at | timestamptz | cleanup time (max(window end, locked_until)); indexed |

Updated with a single upsert per failure; deleted on success; expired rows cleaned opportunistically (like `rate_limit_counter`).

## 5. `appointment` (existing, changed)

| Change | Detail |
|---|---|
| status CHECK | `IN ('confirmed','arrived','completed','no_show','cancelled')` |
| exclusion constraint | `ex_appointment_no_overlap` recreated with `WHERE (status <> 'cancelled')` (R8) |
| new column `version` | `integer NOT NULL DEFAULT 1`, `CHECK (version >= 1)` |
| new index | `ix_appointment_starts_at (starts_at)` |
| code constant | `CONFIRMED_SQL` (slot occupancy) → `OCCUPYING_SQL = "status <> 'cancelled'"`; max-active-per-phone keeps `status = 'confirmed'` |

**Status state machine** (FR-023, FR-024; `now` from `Clock`, `start` = `starts_at`):

```text
confirmed ──Arrived  (now ≥ start − 2h)──▶ arrived ──Completed (any time)──▶ completed  [final]
    │                                         └──No-show (now ≥ start)────▶ no_show    [final]
    ├──No-show   (now ≥ start)──────────────▶ no_show   [final]
    └──Cancelled (now < start)──────────────▶ cancelled [final; frees the slot]

Undo (≤ 10 s, same actor, booking.version unchanged since the change): to → from
  (cancelled → confirmed re-occupies the slot; may fail 409 slot_taken)
```

Past-day bookings: Arrived/Completed/No-show still allowed (tidy-up); Cancel not offered after start (Edge Cases).

## 6. `appointment_status_change` (new)

| Column | Type | Rules |
|---|---|---|
| id | uuid PK | |
| appointment_id | uuid FK → appointment `ON DELETE CASCADE` | index `(appointment_id, occurred_at)` |
| from_status | varchar(12) | same value set as `appointment.status` |
| to_status | varchar(12) | same value set; `CHECK (from_status <> to_status)` |
| actor_staff_id | uuid FK → staff_account `ON DELETE RESTRICT` | |
| occurred_at | timestamptz | `now()` |
| version_after | integer | booking version produced by this change |
| is_undo | boolean | default false |
| undoes_change_id | uuid NULL FK → appointment_status_change | `CHECK (is_undo = (undoes_change_id IS NOT NULL))` |
| undo_expires_at | timestamptz NULL | `occurred_at + 10 s` for normal changes; NULL for undos (an undo cannot be undone) |

The drawer's "status history" = the booking's creation (`created_at`, `confirmed`, actor "Online booking") followed by these rows. Deleted with the booking by the 7-day demo-mode purge.

## 7. `audit_log` (existing, extended — one log, not a second one)

| Change | Detail |
|---|---|
| `actor_type` values | `'anonymous'` (005), `'staff'`, `'system'` (CLI) — `CHECK` added |
| new `actor_staff_id` | uuid NULL FK → staff_account `ON DELETE RESTRICT` |
| new `actor_role` | varchar(16) NULL, `CHECK (actor_role IN ('admin','receptionist'))` |
| new `target_reference` | char(10) NULL — booking reference (not personal data; spec FR-030 requires it) |
| new `from_status`, `to_status` | varchar(12) NULL — status events only |
| `action` CHECK | 005 values + `auth.sign_in`, `auth.sign_in_failed`, `auth.lockout`, `auth.sign_out`, `auth.session_expired`, `auth.password_changed`, `booking.status_changed`, `booking.status_undone`, `booking.phone_revealed`, `staff.created`, `staff.password_reset`, `staff.deactivated`, `staff.reactivated`, `staff.role_changed` |
| `outcome` CHECK | 005 values + `ok`, `refused` (`auth.sign_in_failed` uses `bad_credentials`, `locked`, `inactive`) |
| `target_type` | + `'staff_account'` (target_id = the staff id for staff events) |
| index | `(actor_staff_id, occurred_at)` for the Activity staff filter; `(action, occurred_at)` for the type filter |

Still **no free-text and no personal-data columns**: no password, phone, email, patient name or reason can be stored (FR-030). The "network address" of FR-030 is the existing keyed `actor_fingerprint` (pseudonymous HMAC of the IP, consistent with 005) — the Activity feed shows its first 6 characters as a "device/network tag". Rows are append-only: no update/delete endpoint exists; only the retention purge deletes (demo mode, 90 days).

## 8. Computed (not stored)

**KPIs (FR-017/018)** for local date `d` (and `d − 7` for trends):

| KPI | Definition |
|---|---|
| appointments | count where local date(starts_at) = d and status ≠ cancelled |
| arrived | count status ∈ {arrived, completed} — every patient who reached Arrived today (Completed always passes through Arrived) |
| completed | count status = completed |
| no-shows | count status = no_show |
| cancellations | count status = cancelled (on that appointment date) |
| chair utilisation | appointments ÷ scheduled slots (slot grid of working doctors on d, minus leave, 0 on holiday); whole %, "—" if 0 slots |

Trend = value(d) − value(d−7) (utilisation in percentage points), with an accessible phrase ("up 3 on last Monday").

**Next patients up**: status = confirmed, starts_at ≥ now − 15 min (late arrivals still listed), order by starts_at, limit 5.

**Insights (FR-028)** for range r ∈ {7, 30, 90} ending today: per local day count (zero-filled), by department (all statuses except cancelled, plus a cancelled column), status breakdown (all five), busiest hours (local hour of starts_at, non-cancelled). "Too little data" = fewer than 5 bookings in range → empty state.

**Doctors today (FR-029)**: per doctor with sessions on weekday(d): sessions, scheduled slots, booked (non-cancelled), free = scheduled − booked (free slots already in the past are shown greyed as "passed"), utilisation, next free slot (≥ now). Leave → "On leave"; no session → "Not in today"; holiday → "Clinic closed today" + name.

**Masking** (005 `masking.py`, reused): name in lists/cards `Ayesha K.` (first name + initial — spec FR-019 "masked patient name"; drawer shows full name), phone `0300****567`, email `a****@g****.com`.

## 9. Demo dataset (in memory only — never stored)

```text
DemoDataset(date d, catalog version)
  doctors/departments/weekly schedules: the public sample catalog (read-only)
  holidays/leave:  synthetic — one doctor on leave on ~1 day in 10; no holiday on d itself
  bookings:        for each local day in [d−90, d+14], per working doctor:
                     fill ratio ~ N(0.72, 0.12) clipped [0.35, 0.95], Mon/Sat +10 %, mornings heavier
                     status: past days → completed 84 % / no_show 8 % / cancelled 6 % / … ;
                             today → by time vs request "now" (arrived/completed before now, confirmed after)
                             future → confirmed 94 % / cancelled 6 %
                   reference: Crockford base32 from the PRNG with prefix "D" (never collides with real ones in tests)
                   patient: fits the department (FR-038) — Gynecology: women aged 21–46; Pediatrics: children 0–12
                            booked by a parent ("booked by mother/father"), contact = the parent; Cardiology: adults 38–78;
                            others: adults of any gender. Fixed sample lists of women's, men's, girls' and boys' first
                            names + surname initials; reasons from a per-department list; phone +92300000xxxx
  activity:        synthetic sign-ins, status changes and reveals by 3 sample staff over the last 7 days
  staff:           "Sample Admin", "Sample Receptionist A/B"
Seed: random.Random("shuaib-health-demo:v1:" + d.isoformat())
```

Same shapes as the real API responses (`contracts/command-centre-api.openapi.yaml`), with `isSample: true` on every record (Honesty, Principle I).

## 10. Validation summary (server authoritative)

| Input | Rule | Error |
|---|---|---|
| sign-in email/password | present, ≤ 254 / ≤ 128 chars | 422; wrong → 401 `sign_in_failed` (generic) |
| new password | ≥ 12, ≤ 128, not common, not containing email local part, ≠ current | 422 `weak_password` with reason code |
| staff email | unique (lower-cased) | 409 `email_taken` |
| search `q` | ≤ 80 chars, trimmed, collapsed spaces, `%`/`_`/`\` escaped | 422 |
| date range | `from ≤ to`, span ≤ 92 days, within today−365…today+60 | 422 |
| doctor/department | UUID of any (incl. inactive) record | 422 |
| status filter | subset of the five statuses | 422 |
| page | 1…10 000, page size fixed 20 | 422 |
| status change | `to` allowed from current `from` + time rule; `expectedVersion` matches | 409 `transition_not_allowed` / 409 `booking_changed` |
| undo | latest change, same actor, within window, version unchanged | 409 `undo_unavailable` |
| insights range | 7 / 30 / 90 | 422 |
