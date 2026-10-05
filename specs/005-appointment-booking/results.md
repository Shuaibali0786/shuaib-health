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

## Phase 5 — no double-booking (T069–T074)

Checkpoint 5, run on branch `005-appointment-booking`.

| Command | Result |
|---------|--------|
| `uv run ruff check .` | pass |
| `uv run mypy app` | 1 error, **pre-existing** (`service.py` `utc_iso(row.created_at)`, from the slip commit); nothing new |
| `uv run pytest -k concurrency` ×3 | **4 passed** each time (20-thread race, loser rebooks, 30-minute overlap, stale read caught by the constraint) |
| `uv run pytest` | **393 passed**, 1 skipped (`tzset`), 3 deselected (perf) |
| `npm run typecheck` / `npm run lint` | pass |
| `npm test` (Vitest) | **839 passed** |
| `npm run test:e2e` | **1032 passed**, 11 skipped (same 11 as baseline) |
| `npm run test:e2e:stateful -- booking-race` | 1 passed (two browser contexts; B keeps its details, picks an alternative, third POST carries a new `Idempotency-Key`) |

### SC-002: 100 races of 20 simultaneous bookings (`pytest -m perf`)

Six full runs of `tests/perf/test_booking_concurrency_repeat.py` (600 races, 12,000 requests):

- **Double bookings: 0.** Every race ended with exactly one confirmed row and exactly one `201`.
- **Clean runs (1 × `201` + 19 × `409 slot_taken` in all 100 races): 3 of 6.**
- **Other 3 runs:** in 3 races of one run (races 84, 97, 98) the 19 losers got `503 service_unavailable` instead of `409`. The server logged `database unavailable: OperationalError` once per loser, about one second apart, so the remote test database refused or dropped connections for a moment. The winner still committed. The error text is not logged (by design), and it did not reproduce in the cold-pool test (4 races after `engine.dispose()`) or in the last two full runs, so the cause is not confirmed. The other failed runs did not record per-race detail.

Notes:
- **Race path.** Losers who read before the winner committed hit `ex_appointment_no_overlap` (SQLSTATE 23P01) at the flush; losers who read after it are caught by the pre-check. Both give `slot_taken` with up to 5 next free times. A pre-check refusal is `slot_taken` when the time would be free apart from someone else's booking, otherwise `slot_unavailable`. `test_a_stale_read_still_ends_as_slot_taken_through_the_database_constraint` forces the constraint path.
- **Audit.** Both refusals write `appointment.rejected` with outcome `slot_taken` / `slot_unavailable` and no personal data.
- **Website.** The notice appears under the form, so every field stays. The grid is refreshed when the visitor picks an alternative or "See all times", not at the conflict (refreshing then removed the taken time and unmounted the form). The notice is tied to the refused time, so it clears once the URL shows another choice.

## Phase 8 review and Phase 9 — Book buttons pre-select (T094–T100)

Checkpoint 9, run on branch `005-appointment-booking`.

| Command | Result |
|---------|--------|
| `npm run typecheck` / `npm run lint` | pass |
| `npm test` (Vitest) | **861 passed** (68 files) |
| `npm run test:e2e` | **1044 passed**, 11 skipped (same 11), 0 failed. 1047 tests are listed: the 1043 at Phase 5, 4 added in Phase 8, 8 added here (4 specs x 2 projects); the Phase 8 count of 997 came from an incomplete run, not from removed tests |
| `npm run test:e2e:stateful` | 15 passed |

- **e2e count 1032 → 997.** No test was deleted or skipped. `git diff 130b895 HEAD -- frontend/tests/e2e` only adds specs and edits one assertion (legal). `npx playwright test --list` shows 1047 tests; a clean full run gives 1036 passed + 11 skipped, with no failures.
- **38 visual baselines (Phase 8).** Each old and new image was compared pixel by pixel. Doctor pages (9 × 2): one 14 px text line. Department pages: one sentence, which wraps to two lines on a phone (the page is 20 px taller, the rest is the same content shifted down). About: the privacy card text and the story paragraph. Privacy and Terms: the rewritten copy. Footer rows below the changed text differ by anti-aliasing only. Nothing is broken.
- **Flaky iPhone slip test: real cause.** In `BookingFlow`, the step-change effect moved focus to the step heading. On WebKit it ran 6 ms after the visitor's first keystroke target (`#fullName`) got focus, so the text was typed into nothing: "1 problem with your details", full name empty (5 of 30 runs). The heading focus is now skipped when focus is already in a form field of the step. Afterwards: 0 failures in 40 runs of the same probe.
- **Entry points (US5).** `bookingPath()` builds `?doctor=` / `?department=`; doctor and department Book buttons use it; the date step names the department; an unknown doctor gives the polite note at the department step. SC-001 (doctor page to confirmation, keyboard only) is recorded as a test annotation (`booking-entry.spec.ts`).
- **Baselines for Phase 9.** Only link targets changed (no visible text), so none needed regenerating; the full run is green.
- **Wording.** Phase 8 already replaced the "not available" sentences with "Demo booking with a sample doctor…" / "Demo booking with sample doctors; not a real appointment." These are kept, rather than the slightly different strings in T097/T098.
