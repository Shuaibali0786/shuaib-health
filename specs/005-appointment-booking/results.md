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

## Phase 3 — real slots (T032–T041)

Checkpoint 3, run on branch `005-appointment-booking`.

| Command | Result |
|---------|--------|
| `uv run ruff check .` / `ruff format` | pass |
| `uv run mypy` | pass, 40 source files |
| `uv run pytest` | **289 passed**, 1 skipped (`test_process_time_zone_does_not_change_the_result` needs `time.tzset`, which Windows lacks), 2 deselected (perf) |
| `uv run pytest -m perf -k slots` | **median 175.8 ms, p95 184.4 ms** against the 300 ms budget (Neon, about 85 ms per round trip) |
| `npm run typecheck` / `npm run lint` | pass |
| `npm test` (Vitest) | **714 passed** (58 files) |
| Live `GET /api/v1/doctors/dr-omar-sheikh/slots` on the dev backend | Tuesday 14:00–19:45 with no 17:00–17:59 slot; Saturday 10 Oct `clinic_closed` ("Clinic closed (sample holiday)"); `dr-sana-farooqui` Tuesday 6 Oct `doctor_unavailable` |

Notes:
- **Two queries, not six.** The first version read settings, doctor, sessions, leave, holidays and bookings separately: median 519 ms, p95 547 ms, over budget because each round trip to the remote database costs about 85 ms. `load_booking_context` (settings, doctor, department and weekly sessions in one query) and `load_availability` (leave, holidays and confirmed bookings in one `UNION ALL`) bring it to p95 184 ms. T035's separate `load_*` functions were folded into these two for that reason.
- **Website route not curled live.** Another `next dev` server (not started by this session) already holds port 3000 without `BOOKING_PROXY_SECRET`, so the route's output was proved by `booking-slots-route.test.ts` (11 tests) and the backend by the live call above.
- **`tzset` test.** The process-time-zone test is skipped here by design (T032 allows it); the engine takes the zone as an argument and never reads the process zone.

## Phase 4 — book in under a minute, MVP (T042–T068)

Checkpoint 4, run on branch `005-appointment-booking`.

| Command | Result |
|---------|--------|
| `uv run ruff check .` / `uv run mypy` | pass, 47 source files |
| `uv run pytest` | **389 passed**, 1 skipped (`tzset`, Windows), 2 deselected (perf) |
| `npm run typecheck` / `npm run lint` | pass |
| `npm test` (Vitest) | **803 passed** (62 files) |
| `npm run build` with `CATALOG_API_URL`, `BOOKING_PROXY_SECRET`, `CLINIC_FALLBACK_JSON` unset | pass |
| `npm run test:e2e` | **1028 passed**, 11 skipped (same 11 as baseline); one unrelated lab-test search test failed once under load and passed alone |
| `npx playwright test booking.spec.ts` | 6 passed (mobile and desktop): keyboard-only booking, axe on every step incl. error state and confirmation, reduced motion |
| `npm run test:e2e:stateful` | 11 passed |
| `npm run test:e2e:offline` | 252 passed |

Notes:
- **Steps.** The "confirm" stage is the Confirm button at the end of the Details step, under an "Your appointment" summary; the URL steps are the five in the contract.
- **Browser fetch.** The flow's two browser calls to our own `/api/booking/*` routes live in `lib/booking/client.ts`, now the third allowed `fetch` site (guards updated); the browser never calls the catalog API.
- **e2e without `/__reset`.** The mobile and desktop projects run in parallel against one mock, so a reset would wipe the other's booking. Each uses its own doctors and the first free day/time; the mock store starts empty on every run.
- **Deferred.** `count_active_for_phone` (T054) is added in Phase 7 with its first user. A lost race (23P01) and the `Idempotency-Key` requirement on the backend land in Phases 5 and 6; until then the website route already requires a UUID v4 key and the backend ignores it.
- **Alternatives for `slot_unavailable`** are the next free times after the requested one, or from now when nothing follows it (for example outside the window).
- **Lighthouse** not re-run in this phase.
