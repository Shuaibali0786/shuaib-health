# Results: Feature 005 — Doctor Schedules, Slots and Online Appointment Booking

Evidence log. Sections are filled in as tasks complete. Machine: Windows 11 (dev laptop), Node 24, uv/Python 3.12. Branch `005-appointment-booking`.

## Baseline — backend (T001)

Run from `backend/`, before any Feature 005 change.

| Command | Result | Duration |
|---------|--------|----------|
| `uv run ruff check .` | pass | 2 s |
| `uv run mypy` | pass, 33 source files | 4 s |
| `uv run pytest` | **181 passed**, 1 deselected (perf) | 101 s |

## Baseline — frontend (T002)

Run from `frontend/`, before any Feature 005 change.

| Command | Result | Duration |
|---------|--------|----------|
| `npm run typecheck` | pass | 9 s |
| `npm run lint` | pass | 13 s |
| `npm test` (Vitest) | **624 passed, 2 failed** (626) | 48 s |
| `npm run test:e2e` | **1022 passed**, 11 skipped, 1 failed (flaky) | 7.2 min |
| `npm run test:e2e:stateful` | **11 passed** | 2.8 min |
| `npm run test:e2e:offline` | **252 passed** | 1.7 min |

Baseline failures (both pre-existing, neither caused by Feature 005):
- `api-contract.test.ts` "(1) schema.gen.ts matches a fresh generation" and `api-contract-drift.test.ts` "the unmodified contract passes both checks": the checked-out `schema.gen.ts` had CRLF line endings (Windows checkout, `core.autocrlf=true`) while the generator writes LF. Regenerating the file in T006 wrote LF, and both tests pass again.
- `offline.spec.ts:14` (mobile) "search, FAQ and the contact form work with zero external requests": failed once at the 5 s search-results assertion while the full suite ran in parallel; it passes when run alone (2/2). Treated as load-related flake.

## Baseline — Lighthouse (T003)

Method as in Feature 004: `npm run build && npm run start -- --port 3150` against the mock API (`ok` mode), then `npx lighthouse <url> --preset=perf --form-factor=mobile` × 3, **median** reported. Default simulated mobile throttling.

| Page | Performance (3 runs) | Median perf | LCP (ms) | TBT (ms) | CLS | JS transferred (kB) |
|------|----------------------|-------------|----------|----------|-----|---------------------|
| `/book-appointment` (holding page) | 68 / 67 / 66 | 67 | 2735 | 1262 | 0.000 | 169.3 |
| `/doctors/dr-ayesha-rahman` | 46 / 49 / 45 | 46 | 4478 | 2143 | 0.000 | 176.9 |

Same caveat as Feature 004: this laptop is CPU-bound, so absolute scores are low and run-to-run spread is large. Later comparisons must use the same machine and method. JS kB is the sum of `Script` transfer sizes from Lighthouse's network-requests audit. (Lighthouse's Chrome cleanup fails with an EPERM on Windows temp files and returns a non-zero exit code; the JSON reports were written.)

## Phase 1 — contract (T004–T007)

- T004: the three paths and eight schemas (`Slot`, `AlternativeSlot`, `SlotDay`, `DoctorSlots`, `AppointmentCreate`, `AppointmentView`, `BookingConflict`, `ErrorInfo`) are merged into `specs/003-catalog-api/contracts/openapi.yaml`, `info.version` is 1.1.0. `ErrorInfo` has the same properties as `Error.error`; its `code` enum also lists the booking codes (`forbidden`, `request_rejected`, `slot_taken`, `slot_unavailable`, `booking_limit_reached`, `idempotency_key_reused`). The original `Error` schema is unchanged.
- T005: `PENDING_BOOKING_OPERATIONS` added to `backend/tests/unit/test_openapi_contract.py`; 5 passed.
- T006: `schema.gen.ts` regenerated; `frontend/src/lib/booking/schemas.ts` added.
- T007: type-equality checks, property-name checks and injected-drift tests (removed, renamed, changed type, newly required) added.

| Command | Result |
|---------|--------|
| `uv run pytest tests/unit/test_openapi_contract.py` | 5 passed |
| `npm run typecheck` | pass |
| `npm run lint` | pass |
| `npm test` | **652 passed** (53 files; baseline 624 passed + 2 failed) |

## Phase 2 — foundations (T008–T031)

Checkpoint 2, run on branch `005-appointment-booking`.

| Command | Result |
|---------|--------|
| `uv run ruff check .` / `ruff format --check .` | pass |
| `uv run mypy` | pass, 37 source files |
| `uv run pytest` | **245 passed**, 1 deselected (baseline 181): includes migration up/down, the `23P01` exclusion-violation tests, the fail-fast settings tests and the `committing_engine` fixture tests |
| `npm run typecheck` / `npm run lint` | pass |
| `npm test` (Vitest) | **686 passed** (56 files; baseline 624 passed + 2 failed) |
| `npm run build` with `CATALOG_API_URL`, `BOOKING_PROXY_SECRET` and `CLINIC_FALLBACK_JSON` unset | pass |
| `npm run test:e2e` | **1023 passed**, 11 skipped (same 11 as the baseline) |
| `npm run test:e2e:stateful` | **11 passed** |
| `npm run test:e2e:offline` | **252 passed** |
| `uv run alembic upgrade head` and `uv run python -m app.seed` on the dev database | work: `0001_catalog -> 0002_booking`; seed reports `doctor_leave: 2`, `clinic_holiday: 1` |

Notes:
- **Fail-fast proof.** A production `next start` without `BOOKING_PROXY_SECRET`, or with a short one, exits with "BOOKING_PROXY_SECRET is required (at least 32 characters); refusing to start". The same for the backend (`create_app()` and `python -m app.seed`) and for `PRIVACY_HASH_KEY`. The values are never echoed.
- **T023 snapshot review.** After the seeded Tuesday break for `dr-omar-sheikh` (14:00–17:00 and 18:00–20:00), only `visual-baseline-doctors-dr-omar-sheikh-*` changed. A pixel diff of the old and new desktop image is confined to the schedule table (y 860–1013, x 679–904): the Tuesday row now reads "2 PM – 5 PM and 6 PM – 8 PM" and the Time column is wider. `doctors.json` differs from the old recording only by that session; the other recorded fixtures differ only in line endings, which git normalises.
- **Existing tests updated for the new call site.** The static guards (`guards.test.ts`, `honesty.test.ts`, `single-fetch.test.ts`) now allow `src/lib/booking/backend.ts` as the second `fetch` caller and `src/instrumentation.ts` as a reader of the framework's `NEXT_RUNTIME` / `NEXT_PHASE`. `process.env.BOOKING_PROXY_SECRET` is read only in `lib/api/config.ts`. The client-bundle scan now also forbids the secret's name and the e2e fake value.
- **`register()` is async** and imports `getProxySecret` dynamically, so `server-only` is never pulled into the instrumentation bundle. A production server fails to start (`unhandledRejection` while loading the instrumentation hook).
- **Local `backend/.env`** (git-ignored) now holds generated `BOOKING_PROXY_SECRET` and `PRIVACY_HASH_KEY`; without them every database test is skipped with "backend settings invalid: …".
- **`AlternativeSlot`** was added to `backend/app/schemas.py` in T017 (the 409 body needs it); T036 adds the other slot models.
- **Mock API** gained `tests/mock-api/booking.mjs` (slot rules, bookings, idempotency, lookup, four new modes); `/__log` has a `booking` list of `{method, path, mode, idempotencyKey?}` and never a body. The booking modes only affect booking routes; the catalog behaves as in `ok`.
- **Lighthouse** is not re-run in this phase (no user-facing change yet).
