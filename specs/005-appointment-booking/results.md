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

## Phase 10 — resilience, polish and proof (T101–T106)

Final gate, run on branch `005-appointment-booking`, one check at a time.

### Final gate (T106)

| Command | Result |
|---------|--------|
| `uv run ruff check .` / `ruff format --check .` | pass |
| `uv run mypy` | pass, **100 source files**. `files` is now `["app", "tests"]`, so the test files are checked too |
| `uv run pytest` | **430 passed**, 1 skipped (`tzset`, Windows only), 3 deselected (perf), 7 min 55 s |
| `uv run pytest -m perf tests/perf/test_booking_concurrency_repeat.py` | **passed**, 13 min 0 s (see SC-002 below) |
| `npm run typecheck` / `npm run lint` | pass |
| `npm test` (Vitest) | **861 passed** (68 files) |
| `npm run build` with `CATALOG_API_URL`, `BOOKING_PROXY_SECRET`, `CLINIC_FALLBACK_JSON` unset | pass |
| `npm run test:e2e` | **1044 passed**, 11 skipped (same 11 as baseline), 0 failed, 6.0 min |
| `npm run test:e2e:stateful` | **17 passed** (15 before, plus 2 in `booking-down.spec.ts`) |
| `npm run test:e2e:offline` | **258 passed** (252 before, plus 2 booking tests in `site.spec.ts` and 1 in `unset.spec.ts`, each on desktop and mobile) |
| After the last page change: `booking`, `booking-entry`, `confirmation-slip`, `links` and the book-appointment visual baselines | 21 passed |
| `gitleaks detect --no-banner` | First run: 5 hits, all fake test values (UUID idempotency keys and `test-…-0123456789…` strings in 4 test files, and the task list that quotes them). Fixed with a **path-scoped** allowlist in `.gitleaks.toml` (those 5 files only, no global rule). Second run: **no leaks found**, 66 commits scanned |
| `npm audit --omit=dev` | **0 vulnerabilities** (what ships) |
| `npm audit` (with dev tools) | 5 high, all one chain: `braces` → `micromatch` → `fast-glob` → `@next/eslint-plugin-next` → `eslint-config-next`. Lint tooling only, never in the build output. The only fix offered is `--force`, which installs `eslint-config-next@14` (a breaking downgrade), so it was **not** applied. Needs your decision |
| `pip-audit` (`uv run --with pip-audit`, the backend environment) | **No known vulnerabilities found** |

### SC-002: 100 races of 20 simultaneous bookings (final run)

`tests/perf/test_booking_concurrency_repeat.py`, run once against the remote test database: **100 races, 2,000 requests, 0 double bookings, every race 1 × `201` + 19 × `409 slot_taken`.** 13 min 0 s, under the 15-minute limit. This is a clean run. The earlier intermittent `503` (database connections dropped; 3 of 6 earlier runs) did not occur this time; its cause is still unconfirmed (see Phase 5).

### Polish list

- **Slip.** The CONFIRMED seal is larger (112 px; "CONFIRMED" 16 px bold, date 12 px, other lines 10 px; before, 8.8 to 12.8 px). The logo watermark is 4 % opacity (was 5 %) and sits in the bottom-right corner, clipped by the card, so it is never behind the visit details. On desktop the gap between slip and buttons is 20 px (was 32 px), the button column is 20 rem and the row gap 12 px. On mobile the layout has 7 rem of bottom padding so the sticky Download button never covers the last rows. The PDF is unchanged: its watermark is already a very pale tint (RGB 244/250/249).
- **mypy.** The 24 errors in test files are fixed with typing changes only (`Any` for JSON bodies and query params, `cast` for `__table__`, unused ignores removed, a mypy override for `yaml` stubs). No test logic changed. `mypy` now checks `tests` by default, so they cannot come back.
- **CLS found by Lighthouse.** `/book-appointment` first scored 66 with a layout shift of 0.475: "Before your visit" jumped down when the flow replaced its Suspense fallback. The fallback now reserves the height of the first step. CLS is **0** and the score is 87.

### Lighthouse, mobile, production build (T103)

Method as in T003: `npm run build && npm run start` on port 3150 against the mock API (`ok`), `npx lighthouse --preset=perf --form-factor=mobile`, 3 runs, median.

| Page | Performance (3 runs) | Median | LCP (ms) | TBT (ms) | CLS | JS transferred (kB) |
|------|----------------------|--------|----------|----------|-----|---------------------|
| `/` | 85 / 86 / 89 | **86** | 1903 | 478 | 0 | 284.7 |
| `/doctors` | 88 / 87 / 89 | **88** | 1502 | 456 | 0 | 292.1 |
| `/book-appointment` | 87 / 87 / 86 | **87** | 1311 | 515 | 0 | 271.2 |
| `/doctors/dr-ayesha-rahman` (baseline page) | 91 / 94 / 93 | **93** | 1585 | 286 | 0 | 292.1 |

- **Against the baseline:** the booking page went from 67 (holding page) to 87, and the doctor page from 46 to 93. The laptop was less loaded than at baseline, so the absolute numbers are not one-to-one comparable.
- **The ≥ 90 target (SC-008) is not met on `/book-appointment`** (87), nor on home (86) or doctors (88) on this machine. The gap is main-thread blocking time (TBT about 500 ms), which all pages share. LCP and CLS are good.
- **The "added client JS ≤ 60 KB gzip" budget is not proven.** Every script the booking page loads is also loaded by the home or doctor page, so no chunk is booking-only, and the booking page loads less JS than home or doctors. But total JS per page is higher than at the Phase 1 baseline (booking 169 → 271 kB, doctor page 177 → 292 kB). I did not find which shared change caused this. **Resolved before the PR: see "JS bundle growth: cause and fix" below.**

### Success-criteria evidence (T105)

| SC | Evidence | Status |
|----|----------|--------|
| SC-001 under 60 s, under 45 s from a doctor page | `booking.spec.ts` (keyboard-only booking, mobile and desktop, time in the test annotation); `booking-entry.spec.ts` "from the doctor's page to the confirmation takes under 45 seconds, keyboard only (SC-001)". Both pass in the final e2e run. A manual timed check on a real phone is still open | automated: met |
| SC-002 100 races, 0 double bookings | `tests/perf/test_booking_concurrency_repeat.py`: 100 races, 0 double bookings (above); `test_booking_concurrency.py` (20 threads → 1 × 201 + 19 × 409) | met |
| SC-003 same key → 1 booking | `test_idempotency.py` (sequential replay, 5 concurrent identical requests, drop after commit); `booking-retry.spec.ts` (double click, retry after timeout) | met |
| SC-004 slot reference cases | `tests/unit/test_slots.py` (breaks, leave, holiday, lead time, bookings, day boundary, DST zone); `test_slots_api.py`. The process-time-zone case (`TZ=America/New_York`) is skipped on Windows because `time.tzset` does not exist; the engine takes the zone as an argument and never reads the process zone | met, with that one skip |
| SC-005 no personal data in URLs or logs | `test_log_safety.py`; `booking-privacy.spec.ts`; `test_idempotency.py::test_the_key_table_holds_no_patient_data`; `test_booking_limits.py::test_counters_never_hold_an_ip_or_a_phone_number` | met |
| SC-006 abuse limits | `test_booking_limits.py` (IP, mobile in any format, max active incl. concurrent, trap, lookup, window reset, replays); `booking-limits.spec.ts` | met |
| SC-007 axe and keyboard | `booking.spec.ts` (axe on every step, error state and confirmation; keyboard only); `confirmation-slip.spec.ts` (axe) | met |
| SC-008 times ≤ 1 s, Lighthouse ≥ 90 | Slots p95 **184 ms** against the 300 ms budget (`pytest -m perf -k slots`, Phase 3). Lighthouse **87**, not 90 (above) | **times met; Lighthouse not met on this machine** |
| SC-009 rebook without retyping | `booking-race.spec.ts` (B keeps every field and rebooks with an alternative); `booking-flow.test.tsx` | met |
| SC-010 backend down → friendly page | `offline/site.spec.ts` (new: booking page and confirmation link with the API dead); `offline/unset.spec.ts` (new: nothing configured); `stateful/booking-down.spec.ts` (new: slots down, Retry, POST while down) | met |
| SC-011 7-day purge | `test_retention.py` (old rows purged, recent and future kept, audit rows 90 days, startup and after-booking purge, CLI) | met |
| SC-012 fail fast on the secret | `test_settings.py` (backend and seed CLI); `instrumentation.test.ts` (website); fail-fast proof in Phase 2 | met |
| SC-013 truthful wording | `booking-copy.test.ts` (copy tests for FR-056); `honesty.spec.ts`; the privacy page lists what booking collects | met |

## JS bundle growth: cause and fix (pre-PR)

Phase 10 left the growth unexplained (booking 169 → 271 kB, doctor page 177 → 292 kB). Found with `next experimental-analyze --output` (Turbopack module graph, per-module gzip sizes) and a network trace of each page.

### Cause

1. **`import { z } from "zod"`** in `src/lib/booking/schemas.ts` and `form.ts`. The `z` object re-exports every zod locale (about 50 files of 1.3 kB) and the JSON Schema converters (`toJSONSchema`, `fromJSONSchema`), so none of it can be tree-shaken. zod was **131 kB** (sum of per-module gzip) of the booking route's own modules; react-hook-form 10.6 kB; the booking components about 12 kB.
2. **Prefetch of `/book-appointment` from every page.** The header's "Book appointment" button (and the hero, CTA band, package cards, doctor and department pages, footer, home quick action) is a `<Link>`. `/book-appointment` is a static route, so Next prefetches it in full **including its JavaScript** as soon as the link is on screen. Home, `/doctors`, every doctor page and `/departments` downloaded three booking chunks (100.1 + 18.5 + 13.1 kB) after load. That is why "no chunk is booking-only": every page was fetching them.
3. **Not the cause:** the PDF, QR and calendar code (`slip.ts`, `qr.ts`, hand-written, no library) is only on `/book-appointment/confirmed/[reference]` (about 9 kB). The root layout and shared components import nothing booking-specific.

### Fix

- `import * as z from "zod"` in the two booking schema files: zod on the booking route 131 → 43 kB (per-module).
- `linkPrefetch(href)` in `src/lib/routes.ts` returns `false` for `/book-appointment` (with or without `?doctor=`/`?department=`). Used by `Button`, the footer quick links and the home quick actions. Clicking "Book appointment" now loads the flow on demand.
- The PDF and calendar builders load with `import()` on click (`ConfirmationActions`). The WhatsApp link moved to `src/lib/booking/whatsapp.ts` so rendering it does not pull in `slip.ts`. The builders are now a separate 6.4 kB chunk; a network trace shows it is not fetched when the confirmation page loads, only after "Add to calendar" / "Download".

### Before / after: JS per page (production build, mock API `ok`)

Pixel 7 emulation, Playwright, gzip bytes of every script response after network idle + 3 s. "Initial" = scripts named in the HTML; "later" = fetched afterwards (prefetch).

| Page | Before initial | Before later | **Before total** | After initial | After later | **After total** | Change |
|------|---------------:|-------------:|-----------------:|--------------:|------------:|----------------:|-------:|
| `/` | 149.0 | 131.7 | **280.6** | 149.0 | 13.1 | **162.1** | −118.5 |
| `/doctors` | 151.1 | 136.6 | **287.7** | 151.1 | 18.0 | **169.2** | −118.5 |
| `/doctors/dr-ayesha-rahman` | 145.1 | 142.6 | **287.7** | 145.1 | 24.0 | **169.2** | −118.5 |
| `/departments` | 143.9 | 136.6 | **280.5** | 143.9 | 18.0 | **161.9** | −118.6 |
| `/book-appointment` | 256.6 | 10.9 | **267.5** | 207.3 | 10.9 | **218.2** | −49.3 |

The "later" scripts that remain are prefetches of `/doctors` and doctor pages (doctor browser, `NextAvailable`), the same chunks as before; none is booking code.

### Lighthouse, mobile (same method as T003/T103, 3 runs, median; before and after built side by side and run alternately)

| Page | Build | Performance (3 runs) | Median | LCP (ms) | TBT (ms) | CLS | JS transferred (kB) |
|------|-------|----------------------|--------|----------|----------|-----|---------------------|
| `/` | before | 81 / 85 / 86 | 85 | 2201 | 443 | 0 | 284.7 |
| `/` | after | 84 / 86 / 85 | 85 | 2014 | 486 | 0 | **165.4** |
| `/book-appointment` | before | 84 / 83 / 81 | 83 | 1430 | 649 | 0 | 271.2 |
| `/book-appointment` | after | 86 / 85 / 84 | 85 | 1436 | 535 | 0 | **221.9** |

- The "before" JS figures match Phase 10 exactly (284.7 and 271.2 kB), so the method is the same.
- Booking page against the Phase 1 holding page: 221.9 − 169.3 = **52.6 kB added, within the 60 kB budget**.
- The score target of 90 is still not met on this machine. TBT (about 500 ms) is shared by all pages, and on home the removed JS was prefetched after load, so it hardly moved the score.

**Re-run on fresh clones** (before = `1ceefa0`, after = the PR head), same method: per-page JS identical to the table above. Lighthouse: `/book-appointment` 81 / 85 / 77 → 86 / 83 / 86 (median **81 → 86**, TBT 748 → 538 ms, JS 271.2 → 221.9 kB); `/` 83 / 85 / 86 → 83 / 85 / 85 (median **85 → 85**, TBT 511 → 493 ms, JS 284.7 → 165.4 kB).

### Quickstart on a clean checkout

Fresh clone of the branch with `backend/.env` and `frontend/.env.local` copied in (the quickstart prerequisites). Migrate, seed, API and `npm run dev` start; the "Try it" steps pass (pre-selected doctor, masked name and `XXXXX-XXXXX` reference, "just taken" with 5 alternatives in a second tab, no Tuesday 17:00 slots); `ruff`, `mypy`, typecheck and lint pass.

- **Fixed:** the two contract tests (`api-contract`, `api-contract-drift`) failed on a fresh Windows clone because `core.autocrlf=true` checked `schema.gen.ts` out with CRLF, while the generator writes LF. `.gitattributes` now has `*.gen.ts text eol=lf`. On a new clone the file is LF and the full Vitest run passes (862 passed, 1 skipped: `no-api-url-in-client` skips when there is no build output yet).
- **The `409`s while trying it out** were `booking_limit_reached` ("This mobile number already has the maximum upcoming bookings"), from reusing one test mobile number; `max_active_bookings_per_phone` is 3 in the dev database. With fresh numbers the steps pass.
