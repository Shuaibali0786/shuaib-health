# Data Model: Appointment Booking

**Feature**: 005-appointment-booking | **Migration**: `backend/migrations/versions/0002_booking.py` (reversible; down revision `0001_catalog`)

Conventions follow `specs/003-catalog-api/data-model.md`:
- names come from the `SQLModel.metadata.naming_convention`;
- tables have UUID primary keys from `gen_random_uuid()` and `created_at`/`updated_at`;
- every instant is `timestamptz`, which is UTC at rest. Code passes only aware datetimes and normalizes reads with `.astimezone(UTC)`. The session time zone is not relied on, because of PgBouncer transaction mode (research R5).

## 1. `clinic_settings` (existing, additive columns)

| Column | Type | Rules | Default |
|---|---|---|---|
| booking_window_days | smallint | `CHECK (booking_window_days BETWEEN 1 AND 60)` | 14 |
| booking_lead_minutes | smallint | `CHECK (booking_lead_minutes BETWEEN 0 AND 10080)` | 120 |
| max_active_bookings_per_phone | smallint | `CHECK (max_active_bookings_per_phone BETWEEN 1 AND 20)` | 3 |

These columns are **not** added to the public `ClinicSettings` API schema. The slots response exposes `windowDays` instead, so the Feature 004 contract stays unchanged for `/clinic`.

## 2. `doctor_weekly_schedule` (existing, unchanged)

- A day can have several sessions; breaks are the gaps between them.
- The existing exclusion constraint already prevents overlapping sessions.
- `slot_minutes` defines the slot grid: slots start at `start_time + k × slot_minutes` and must end by `end_time`.

## 3. `doctor_leave` (new)

| Column | Type | Rules |
|---|---|---|
| id, created_at, updated_at | | standard |
| doctor_id | uuid FK → doctor `ON DELETE CASCADE` | indexed with starts_at |
| starts_at | timestamptz | |
| ends_at | timestamptz | `CHECK (ends_at > starts_at)` |
| note | varchar(200) NULL | internal only; never in any API response or log |
| is_sample | boolean | default false |

- Whole-day leave is stored as local midnight to the next local midnight, converted to UTC when written.
- The index on `(doctor_id, starts_at)` serves the slot query `starts_at < :window_end AND ends_at > :window_start`.

## 4. `clinic_holiday` (new)

| Column | Type | Rules |
|---|---|---|
| id, created_at, updated_at | | standard |
| holiday_date | date | `UNIQUE`; a calendar date in the clinic time zone |
| name | varchar(80) | public, e.g. "Clinic closed" or the holiday name |
| is_sample | boolean | default false |

## 5. `appointment` (new)

| Column | Type | Rules |
|---|---|---|
| id, created_at, updated_at | | standard |
| reference | varchar(10) | `UNIQUE`; `CHECK (reference ~ '^[0-9A-HJKMNP-TV-Z]{10}$')` (Crockford base32, stored without the dash) |
| doctor_id | uuid FK → doctor `ON DELETE RESTRICT` | |
| department_id | uuid FK → department `ON DELETE RESTRICT` | snapshot at booking |
| starts_at | timestamptz | |
| ends_at | timestamptz | `CHECK (ends_at > starts_at)` |
| status | varchar(12) | `CHECK (status IN ('confirmed','cancelled','completed'))`; only `confirmed` is written in this feature |
| fee_pkr | integer | `CHECK (fee_pkr >= 0)`; doctor's fee at booking, set by the server |
| patient_name | varchar(80) | trimmed; 2–80 characters; letters (any script), spaces, `.`, `'`, `-` |
| patient_phone | varchar(13) | `CHECK (patient_phone ~ '^\+923[0-9]{9}$')`; normalized E.164 |
| patient_email | varchar(254) NULL | lower-cased; basic format check in app |
| reason | varchar(300) NULL | plain text |
| rules_accepted_at | timestamptz | server time of acceptance |
| rules_version | varchar(16) | first 16 hex chars of SHA-256 of the active rules' text joined in order, computed by the server |
| is_sample | boolean | default true for every booking in this demo (spec FR-025) |

**Constraints and indexes**

- `ex_appointment_no_overlap`:
  `EXCLUDE USING gist (doctor_id WITH =, tstzrange(starts_at, ends_at, '[)') WITH &&) WHERE (status = 'confirmed')`.
  This is the double-booking guarantee (Principle III, FR-030). It is written in the migration only (like `0001`'s schedule constraint), and the model docstring says so.
- `ix_appointment_patient_phone_active` on `(patient_phone, starts_at) WHERE status = 'confirmed'`. It serves the max-active-bookings count.
- The gist index behind the exclusion constraint also serves "confirmed bookings of doctor X between A and B" for slot generation.

**Retention (demo mode, research R12)**

- Rows with `ends_at < now() - BOOKING_PURGE_AFTER_DAYS` (default 7) are hard-deleted by `booking/retention.py`, in batches of at most 200.
- It runs on startup in the background, after each booking commit, and from the CLI.
- `idempotency_key` rows are removed with them by cascade. `audit_log` rows have no foreign key and no personal data. They stay until their own 90-day purge (§8).
- An index on `(ends_at)` serves the purge.

**State transitions**

- In this feature, a booking only moves from no row to `confirmed`.
- `confirmed → cancelled` and `confirmed → completed` are reserved for later features. They need no constraint change, and a cancelled row frees its slot automatically because the exclusion constraint is partial.

## 6. `idempotency_key` (new)

| Column | Type | Rules |
|---|---|---|
| key | uuid PK | client-generated v4, validated |
| scope | varchar(40) | `'appointment.create'` |
| request_hash | char(64) | SHA-256 hex of the canonical normalized request; no plain values stored |
| appointment_id | uuid FK → appointment `ON DELETE CASCADE` NULL | NULL only inside the creating transaction |
| created_at | timestamptz | |
| expires_at | timestamptz | created_at + 24 h; indexed for cleanup |

A row exists only when a booking was created (it is inserted in the same transaction). See research R2 for the flow.

## 7. `rate_limit_counter` (new)

| Column | Type | Rules |
|---|---|---|
| bucket | varchar(80) | e.g. `booking:ip:<32 hex>`; value part is an HMAC, never a raw IP or phone |
| window_start | timestamptz | window floor (hour / day / minute) |
| count | integer | `CHECK (count >= 1)` |
| expires_at | timestamptz | window end; indexed for cleanup |

Primary key: `(bucket, window_start)`. Updated by a single upsert statement (research R3).

Windows are **fixed and aligned to UTC**:
- `window_start` is the instant floored to the minute, the hour, or UTC midnight, for the 1-minute, 1-hour and 24-hour limits.
- The "per 24 hours" phone limit therefore resets at 05:00 Asia/Karachi. Tests freeze the clock, so this is deterministic.

## 8. `audit_log` (new)

| Column | Type | Rules |
|---|---|---|
| id | uuid PK | |
| occurred_at | timestamptz | `now()` |
| actor_type | varchar(20) | `'anonymous'` in this feature (roles arrive with auth) |
| actor_fingerprint | char(16) | HMAC of the client IP, truncated; not reversible |
| action | varchar(40) | `CHECK (action IN ('appointment.created','appointment.rejected'))` |
| outcome | varchar(30) | for created: `ok`; for rejected: `rate_limited_ip`, `rate_limited_phone`, `limit_reached`, `trap`, `slot_taken`, `slot_unavailable` |
| target_type | varchar(30) NULL | `'appointment'` |
| target_id | uuid NULL | the appointment id when one exists |
| request_id | varchar(64) NULL | from `X-Request-ID` |

There are no free-text or personal-data columns, so a code review can confirm nothing personal is stored (FR-053).

- **Retention (demo mode)**: rows with `occurred_at < now() - AUDIT_PURGE_AFTER_DAYS` (default 90, allowed 7–365) are deleted by the same `booking/retention.py` purge (FR-054).
- **Index**: `(occurred_at)`.

## 9. Computed: slot and day (not stored)

```text
Inputs: now (UTC), tz, window_days, lead_minutes, sessions(doctor), leave(doctor, window),
        holidays(window), confirmed bookings(doctor, window), doctor/department active flags
For each local date d in [today_local, today_local + window_days - 1]:
  if d is a clinic holiday                → status "clinic_closed", reason = holiday name
  elif doctor has no session on weekday(d) → status "not_working"
  else candidates = grid slots of each session (start + k·len, end ≤ session end), localized to UTC
       drop candidates starting before now + lead      (counted as "past")
       drop candidates overlapping leave                (counted as "leave")
       drop candidates overlapping a confirmed booking  (counted as "booked")
       status = "available" if any remain
              else "doctor_unavailable" if leave removed any and none were booked
              else "fully_booked"       if booked removed any
              else "no_longer_available" (all past / inside lead time)
```

- **Statuses**: `available | fully_booked | doctor_unavailable | clinic_closed | not_working | no_longer_available`.
- **Public labels** (shown by the website): Available, Fully booked, Not available, Clinic closed, Not available, No times left today.
- The leave note is never exposed.

## 10. Validation summary (server is authoritative)

| Field | Rule | Error code |
|---|---|---|
| doctorSlug | active doctor in an active department | `422 validation_error` (field `doctorSlug`) |
| startsAt | UTC instant equal to an available slot start for that doctor right now | `409 slot_unavailable` (with alternatives) |
| fullName | trimmed, 2–80 characters, letters/marks/space/`.'-` | 422 |
| mobile | Pakistani mobile (research R9) → E.164 | 422 |
| email | optional, ≤ 254 characters, simple `local@domain.tld` | 422 |
| reason | optional, ≤ 300 characters, control characters stripped | 422 |
| acceptRules | must be `true` | 422 |
| trap | must be empty or absent | `400 request_rejected` (generic) |
| Idempotency-Key header | required UUID v4 | 422 |
