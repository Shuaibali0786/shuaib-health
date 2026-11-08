# Data Model: Voice Receptionist (013)

> ⚠ **Database migration needed: `0006_patient_access`** (additive). Per the owner's rule, **implementation stops before this migration is created or run** until Shuaib has made a Neon restore point and approved it. See [quickstart.md](quickstart.md#migration-gate).

## 1. Browser-only (no storage after the chat closes)

### VoiceConversation (React state, in memory)

| Field | Type | Notes |
|---|---|---|
| mode | `patient` \| `guide` | Same tabs as Feature 010 |
| lang | `en` \| `roman` \| `ur` | Updated from each caller turn (R3) |
| listenLang | `en-PK` \| `ur-PK` | EN / اردو toggle |
| voicePref | `female` \| `male` | Persisted in `localStorage` (try/catch), the only persisted item |
| state | `idle` \| `listening` \| `thinking` \| `speaking` \| `paused` | Drives the orb |
| turns | `Turn[]` | Shared with the text chat history (FR-003) |
| draft | `BookingDraft \| null` | |
| bookingsMade | `0 \| 1` | FR-046 |
| lookup | `LookupDraft \| null` | |
| noUrduVoiceNoted | boolean | Say the note once (FR-014) |
| privacyNoted | boolean | Say "never recorded" once (FR-015) |

### BookingDraft

Each field is `{ value, status: missing | heard | confirmed | corrected, heardAt }`:
`fullName`, `phone` (E.164), `reason` (≤ 300 characters), `departmentSlug`, `doctorSlug`, `date` (Karachi local), `time` → `startsAt` (from a live free slot only), `email` (optional).

Phase is one of: `collecting`, `offering_slots`, `read_back`, `awaiting_yes`, `submitting`, `booked`, `failed`.

**Transitions**:

```
collecting ──all required present──▶ offering_slots ──slot chosen──▶ read_back ──spoken──▶ awaiting_yes
awaiting_yes ──next caller turn = clear yes──▶ submitting ──201──▶ booked (bookingsMade = 1)
awaiting_yes ──anything else / correction──▶ collecting or read_back (nothing submitted)
submitting ──409 slot_taken──▶ offering_slots (server alternatives) ; ──429/limit──▶ failed (clinic number)
any ──emergency words──▶ paused (emergency reply first)
```

**Invariants**: `startsAt` is always one of the slots last fetched for `doctorSlug` and `date`. The Idempotency-Key is created once per draft at `awaiting_yes`.

### LookupDraft

`path` (`reference` | `email_code` | `cancel`), `reference`, `phoneLast4`, `email`, `codeSentAt`, `triesLeftHint`, `result` (`LookupView[]`). The email is cleared from memory once the code is verified.

## 2. Server: new table (migration 0006)

### `patient_access_code`

| Column | Type | Rules |
|---|---|---|
| id | uuid PK | |
| purpose | varchar(8) | CHECK in (`lookup`, `cancel`) |
| target_hash | char(64) | HMAC of the lower-cased email (lookup) or the reference (cancel) |
| caller_hash | char(16) | HMAC of the client IP (same fingerprint as `audit_log`) |
| code_hash | char(64) | HMAC-SHA256(`privacy_hash_key`, id ‖ code) |
| appointment_id | uuid NULL FK → appointment (CASCADE) | Set for `cancel` only |
| created_at | timestamptz | |
| expires_at | timestamptz | created_at + 10 min; indexed |
| resend_after | timestamptz | created_at + 60 s |
| tries | smallint | 0..3, CHECK `tries BETWEEN 0 AND 3` |
| used_at | timestamptz NULL | Single use |

- Index `(purpose, target_hash, created_at DESC)`.
- Only the newest unexpired, unused row per (purpose, target) is valid. Creating a new row expires the older ones (`expires_at = now`).
- The daily maintenance (Vercel Cron, existing endpoint) deletes rows expired for more than 24 h.
- There is no plaintext email, code or reference in this table.

### Changed CHECK constraint: `audit_log.action_valid` (drop and recreate, as in 0004)

New actions:
- `patient.lookup`
- `patient.lookup_failed`
- `patient.code_sent`
- `patient.code_failed`
- `booking.cancelled_by_patient`
- `patient.slip_emailed`

New outcome in `outcome_valid`: `not_found`. Actor: `actor_type = 'anonymous'`, `actor_fingerprint` = caller hash, `target_reference` set only on success (a failure stores none).

### Not changed

- `appointment`: no column change. A patient cancel sets `status = 'cancelled'` and bumps `version`.
- `appointment_status_change` requires a staff actor (`actor_staff_id NOT NULL`), so a patient cancel writes **no** row there. The audit log is the record. Effect: staff "Undo" is not offered for a patient cancel; staff can rebook. A test covers this.
- `rate_limit_counter`: reused, with new bucket prefixes and no schema change:
  - `lk-fail:ref:<h>`, `lk-fail:email:<h>`, `lk-fail:ip:<h>`: 1 h window, limit 3, failures only;
  - `code-send:email:<h>`: 1 h, 3;
  - `code-send:ip:<h>`: 1 h, 5;
  - `lookup:ip:<h>`: existing per-minute lookup limit;
  - `mail:day`: 24 h, `PATIENT_EMAIL_DAILY_CAP`.

## 3. Response shapes

### LookupView (the only data a lookup returns)

`reference`, `status`, `localDate`, `localTime`, `timeZone`, `doctor { slug, name }`, `department { slug, name }`, `feePkr`, `patientNameMasked`, `mobileMasked`, `bookedAt`, `isSample`.

It is the same masked shape as the existing `AppointmentView`, reused so the existing slip builder (`buildSlipPdf`) works unchanged. There is no email, no full phone and no reason.
