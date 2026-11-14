# API Change: Patient booking access (013)

**Status**: Proposed (owner approval needed: API contract change, FR-050..FR-057)
**Version**: additive, under the existing public API. No existing endpoint changes.
**Callers**: the website BFF only (same-origin `/api/booking/...` route handlers, proxy secret). The browser never calls the backend origin (Principle VI). The voice receptionist, and later a web "Find my booking" page, use the same endpoints (Principle IV).
**Flag**: `VOICE_LOOKUP_ENABLED` (backend and website). When off, every endpoint returns 404 `not_found`.

Common rules for every endpoint below:
- `POST`, JSON, body ≤ 1 KB, `extra="forbid"`, camelCase.
- BFF: Origin and `sec-fetch-site` same-origin check (existing CSRF guard), content-type check.
- Backend: `ProxySecretDep`, client IP from the trusted proxy header (ADR-0006).
- `Cache-Control: no-store`.
- Every failure that depends on the input is **one** response: `404 {"error":{"code":"not_found","message":"No booking matches those details."}}`, returned after a ≥ 300 ms floor.
- `429 rate_limited` with `Retry-After` when a lock or limit applies. It is the same body whether the lock is on the target or on the caller.
- `503 service_unavailable` when the database or email is down.
- Logs and audit hold hashed identifiers only.

---

## 1. `POST /appointments/lookup`: reference + last 4 phone digits

Request:
```json
{ "reference": "7K3M9P2QXA", "phoneLast4": "4567" }
```
- `reference`: 10 characters, Crockford base32 (the existing `parse()`); `phoneLast4`: `^[0-9]{4}$`.

Responses:
- `200` → `LookupView` (see data-model §3).
- `404 not_found`: unknown reference, malformed reference, or wrong digits (all the same).
- `429`: existing per-IP lookup limit, **or** `lk-fail:ref` ≥ 3, **or** `lk-fail:ip` ≥ 3 within 1 h.

Side effects:
- A failure increments `lk-fail:ref:<h>` (only when the reference exists) and `lk-fail:ip:<h>`.
- Audit `patient.lookup` / `patient.lookup_failed`.

## 2. `POST /appointments/access-codes`: send a 6-digit code

Request, one of:
```json
{ "purpose": "lookup", "email": "ayesha@example.com", "lang": "en" }
{ "purpose": "cancel", "reference": "7K3M9P2QXA", "lang": "roman" }
```
Responses:
- `202 {"sent": true, "resendAfterSeconds": 60, "expiresInSeconds": 600}`: **always the same**, whether or not a booking matches, and whether or not the booking has an email.
- `429`: `code-send:email` > 3/h, `code-send:ip` > 5/h, the target is locked, or a resend comes before `resend_after`. The `Retry-After` header carries the wait.
- `503`: only when the database is down. An email-provider failure or the daily cap still returns 202: the caller sees no difference, and the audit outcome records it.

Side effects:
- The code is sent only when it can be used:
  - `lookup`: at least one booking with this email (case-insensitive) and status `confirmed` or later in the last 90 days or in the future;
  - `cancel`: the booking exists, has an email, and is cancellable.
- A new code row expires any older row for the same (purpose, target).
- Audit `patient.code_sent`.

## 3. `POST /appointments/access-codes/verify`: code → bookings

Request:
```json
{ "purpose": "lookup", "email": "ayesha@example.com", "code": "482913" }
```
Responses:
- `200 {"bookings": [LookupView, ...]}`: at most 5, newest first, upcoming before past. The code is marked used.
- `404 not_found`: wrong, expired or used code, or unknown email. Each wrong try increments `tries` and `lk-fail:email` / `lk-fail:ip`.
- `429`: `tries` reached 3 (the code is dead), or a target or caller lock.

## 4. `POST /appointments/{reference}/cancel`: cancel with code

Request:
```json
{ "code": "482913" }
```
- The website sends this only after the caller's spoken yes to the read-back (FR-054). The server cannot hear the yes; the code is its proof.

Responses:
- `200` → `LookupView` with `status: "cancelled"`. The code is marked used.
- `404 not_found`: wrong, expired or used code, or an unknown reference.
- `409 not_cancellable`: the code is correct, but the booking is past, already cancelled, or completed. The caller already proved access, so the specific reason is safe to give.
- `429`: as above.

Side effects:
- `rules.is_allowed(confirmed → cancelled)` applies.
- `status = 'cancelled'`, `version + 1`, and the slot is freed.
- Audit `booking.cancelled_by_patient`, with the actor anonymous and hashed.

---

## Internal change (no new endpoint): slip email on booking

- After a successful `POST /appointments` with an `email`, when `PATIENT_EMAIL_ENABLED` is on and `mail:day` is under the cap, one "Your appointment" email is sent. It holds the reference, date, time, doctor and department, a confirmation-page link, and the arrival reminder.
- It is best effort, like Feature 012 alerts: a failure never fails the booking.
- Audit `patient.slip_emailed`.

## Pluggable code channel

- `LOOKUP_CODE_CHANNEL=email` (v1 only). `CodeSender` protocol: `send(target: str, code: str, lang: Lang) -> bool`.
- `sms` and `whatsapp` are reserved values that fail config validation until a sender exists. Adding one needs a contract change for the `phone` target (a new request field), so it is planned as a separate change.

## Error taxonomy (additions)

| Status | code | When |
|---|---|---|
| 404 | `not_found` | Any input-dependent failure (lookup, code, cancel) |
| 409 | `not_cancellable` | Proven access, but the booking cannot be cancelled |
| 429 | `rate_limited` | Limits and locks (existing code) |
