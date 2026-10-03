---
description: "Task list for Feature 004 — Connect the public website to the catalog API"
---

# Tasks: Connect the Public Website to the Catalog API

**Input**: Design documents from `/specs/004-catalog-api-integration/`
**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md), [ADR-0004](../../history/adr/0004-catalog-caching-and-resilience-strategy.md)

**Tests**: REQUIRED. Spec FR-070–FR-072 and constitution IX require them. Tests are written before the code they cover and must fail first.

**Paths**: unless a path starts with `specs/`, `backend/` or `history/`, it is relative to `frontend/`. Commands run from `frontend/` in Windows CMD.

**Before writing Next.js code**: read the relevant guide in `node_modules/next/dist/docs/` (per `frontend/AGENTS.md`). In particular: `01-app/02-guides/incremental-static-regeneration.md`, `01-app/03-api-reference/04-functions/unstable_cache.md`, `generate-static-params.md`, and route segment config `dynamicParams`.

**Constitution phase (Principle X)**: every task in this file belongs to **Phase 2 — Backend**. The feature connects the website to the Phase 2 catalog API and references no Phase 3–5 deliverable (staff app, deploy, chatbot).

**Three Playwright configs** (analysis C1–C5):
- `playwright.config.ts` (**main**): production build against the mock API in `ok` mode only. It never switches modes, so it can run fully parallel.
- `playwright.stateful.config.ts` (**stateful**, specs in `tests/e2e/stateful/`): one worker. Mode-switching specs run against `next dev` with a 3 s data-cache window. Production pages are ISR with a literal `revalidate = 300`, so a production page never re-renders inside a test. `next dev` renders every request but still goes through `unstable_cache`, so a mode switch really reaches the data layer. Every stateful spec asserts through the mock request log that the API was called after the switch, so a test cannot pass without exercising the path.
- `playwright.offline.config.ts` (**offline**, specs in `tests/e2e/offline/`): production builds with the API dead or unset.
Each server builds into its own `NEXT_DIST_DIR`, so builds never collide.

**Checkpoints**: every phase ends with a **CHECKPOINT**. Run the listed commands, then stop and report to the user (what changed, results, anything surprising) before starting the next phase.

## Format: `- [ ] [ID] [P?] [Story] Description with file path`

- **[P]**: can run in parallel (different files, no dependency on an unfinished task)
- **[USn]**: user story from spec.md (US1 live catalog P1, US2 resilience P1, US3 identity & rules P2, US4 developer trust P2)

---

## Phase 1: Setup & Baseline

**Purpose**: Record today's state so "no visual change" and "as fast as today" can be proved, then add tooling.

- [X] T001 Run `npm run typecheck`, `npm run lint`, `npm test`, `npm run test:e2e` on the current branch; record pass counts and durations in `specs/004-catalog-api-integration/results.md` (create file, section "Baseline").
- [X] T002 [P] Add `tests/e2e/visual-baseline.spec.ts`: for every public route (`/`, `/about`, `/contact`, `/book-appointment`, `/departments`, `/departments/<each slug>`, `/doctors`, `/doctors/<each slug>`, `/lab-tests`, `/lab-tests/<3 slugs>`, `/health-packages`, `/faq`, `/health-tips`, `/privacy`, `/terms`), take a full-page screenshot at mobile (Pixel 7) and desktop (1280×800) with `expect(page).toHaveScreenshot({ fullPage: true, animations: "disabled" })`. Generate the baselines with `npx playwright test visual-baseline --update-snapshots` and commit them under `tests/e2e/visual-baseline.spec.ts-snapshots/`. Take slugs from `src/data/*.ts` for now.
- [X] T003 [P] Run Lighthouse (mobile preset, 3 runs, median) against `npm run build && npm run start` for `/`, `/doctors`, `/lab-tests`, `/health-packages`; record performance score, LCP, TBT, CLS and total JS kB in `specs/004-catalog-api-integration/results.md` ("Baseline — Lighthouse"). Use `npx lighthouse <url> --preset=perf --form-factor=mobile --output=json` or Chrome DevTools.
- [X] T004 Install the one new dev dependency: `npm install -D openapi-typescript`, and record the exact version in `package.json`. Do **not** install `server-only`: Next 16 resolves `import "server-only"` itself and ships its types (`node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md`, "installing `server-only` … is optional"). Vitest does not use Next's resolver, so add `resolve.alias: { "server-only": "./tests/unit/helpers/server-only-stub.ts" }` to `vitest.config.mts` and create the stub as an empty module (`export {};`) with a one-line comment explaining why.
- [X] T005 Add scripts to `package.json`: `"api:types": "openapi-typescript ../specs/003-catalog-api/contracts/openapi.yaml -o src/lib/api/schema.gen.ts"`, `"api:record": "node scripts/record-api-fixtures.mjs"`, `"mock-api": "node tests/mock-api/server.mjs"`, `"test:e2e:offline": "playwright test -c playwright.offline.config.ts"`, `"test:e2e:stateful": "playwright test -c playwright.stateful.config.ts"`.
- [X] T006 [P] Update `.env.example`: add `CATALOG_API_URL=http://localhost:8000` and `CLINIC_FALLBACK_JSON=` with comments saying both are server-only, the build works when they are unset, and the fallback is used only when clinic settings have never loaded (contracts/data-access.md §4). Add `CATALOG_DATA_REVALIDATE_SECONDS=` with the comment "Tests only. Leave unset (default 300)." Confirm `.env.local` is git-ignored in `.gitignore`, and add `.next-*/` (the per-server build folders from T081).

**CHECKPOINT 1**: baseline numbers and screenshots committed; `npm test` still green; `npm run api:types` runs (output may be discarded until T009).

---

## Phase 2: Foundational (blocks all user stories)

**Purpose**: Typed contract, fixtures, the data-access layer with last-good semantics, the shared fallback UI, and the mock API harness. Pages do **not** change in this phase.

### 2a. Types, fixtures, schemas

- [X] T007 Move `src/data/departments.ts`, `src/data/doctors.ts`, `src/data/labTests.ts`, `src/data/healthPackages.ts`, `src/data/siteConfig.ts` to `tests/fixtures/catalog/` unchanged (`git mv`). Leave temporary re-export shims at the old paths (`export * from "../../tests/fixtures/catalog/doctors";` etc.) so nothing breaks yet; shims are deleted in T047/T062. Update `scripts/catalog-object.mjs` imports to `../tests/fixtures/catalog/*.ts`. Run `npm test`; `tests/unit/catalog-export.test.ts` must stay green.
- [X] T008 Widen white-label types in `src/types/content.ts` (additive only, data-model §3): `SiteConfig.timeZone: string` (was literal `"Asia/Karachi"`), add optional `SiteConfig.logo?: ImageAsset` and `SiteConfig.brandColors?: { primary: string; accent: string }`, add optional `ScheduleSession.slotMinutes?: number`, add `export interface ClinicRule { id: string; sortOrder: number; text: string; isSample: boolean }`. Fix any type errors this causes; `npm run typecheck` must pass.
- [X] T009 Generate `src/lib/api/schema.gen.ts` with `npm run api:types`; add a header comment "GENERATED — do not edit; run npm run api:types". Exclude it from ESLint in `eslint.config.mjs` if lint complains.
- [X] T010 Create `src/lib/api/schemas.ts`: zod 4 schemas `ImageAssetSchema`, `PhoneNumberSchema`, `OpeningHoursRuleSchema`, `ClinicSettingsSchema`, `ClinicRuleSchema`, `DepartmentSchema`, `ScheduleSessionSchema`, `DoctorSchema`, `LabTestCategorySchema`, `LabTestSchema`, `HealthPackageSchema`, and `pageSchema(item)` for `{items,total,page,pageSize}`. Follow the field lists in `specs/003-catalog-api/contracts/openapi.yaml` (components.schemas). Apply the data-model §2 rules: strip unknown keys; slug regex `^[a-z0-9]+(?:-[a-z0-9]+)*$`; integer ≥ 0 prices; hex colours `^#[0-9A-Fa-f]{6}$`; image `src` must start with `/images/`. Export the inferred types.
- [X] T011 Create `scripts/record-api-fixtures.mjs`: reads `CATALOG_API_URL` (default `http://localhost:8000`) and GETs `/api/v1/clinic` and the six list endpoints with `pageSize=100`. It writes pretty JSON to `tests/fixtures/api/{clinic,clinic-rules,departments,doctors,lab-test-categories,lab-tests,health-packages}.json` and exits non-zero with a clear message if the API is unreachable.
- [X] T012 Start the seeded backend (see `quickstart.md` §1), run `npm run api:record`, and commit `tests/fixtures/api/*.json`. In `tests/fixtures/api/README.md`, note that the fixtures were recorded from the Feature 003 seed and how to re-record them.

### 2b. Contract tests (US4 groundwork, written first)

- [X] T013 [P] Create `tests/unit/api-contract.test.ts` with these checks:
  - (1) run `openapi-typescript` programmatically (its Node API) on the contract and compare with `src/lib/api/schema.gen.ts`; on mismatch, name the first differing line and say "run npm run api:types";
  - (2) `expectTypeOf<z.infer<typeof XSchema>>().toEqualTypeOf<components["schemas"]["X"]>()` for each schema in T010 (relax to `toMatchTypeOf` only where the generator emits wider types, with a comment);
  - (3) `expectTypeOf<components["schemas"]["Doctor"]>().toMatchTypeOf<Doctor>()` and the same for Department, LabTestCategory, LabTest, HealthPackage, ImageAsset, and ClinicSettings→SiteConfig;
  - (4) every file in `tests/fixtures/api/` parses with its schema.
- [X] T014 [P] Create `tests/unit/api-fixture-parity.test.ts`: for each resource, compare recorded API fixtures with `tests/fixtures/catalog/*.ts` field by field, matched by slug, ignoring `id`, `departmentId`, `categoryId`, `relatedDepartmentIds` (compare them by resolved slug instead) and the additive fields (`slotMinutes`, `logo`, `brandColors`). Clinic settings are compared with `siteConfig`.
- [X] T015 [P] Create `tests/unit/api-contract-drift.test.ts`: take a deep copy of the parsed OpenAPI YAML (add `yaml` as a dev dependency if no YAML parser is available; check `node_modules` first). Apply four injected drifts to `Doctor` (remove `bio`, rename `fullName`→`name`, change `feePkr` to string, add newly required `rating`), regenerate types or validate a fixture against a schema built from each drift, and assert that checks (1) and (4) **detect** each drift (SC-007).

### 2c. Data-access layer (contracts/data-access.md)

- [X] T016 [P] Write `tests/unit/api-http.test.ts` (fails first). Stub `globalThis.fetch` with `vi.fn` and test `getJson`:
  - 200 valid → parsed data;
  - unset URL → `ApiError{kind:"unconfigured"}` and no fetch call;
  - invalid URL scheme → `unconfigured`;
  - fetch rejects → `network`;
  - hang past 3000 ms (fake timers + `AbortSignal.timeout` polyfill, or inject the timeout) → `timeout`;
  - 404/429/500 → `status` with the status code;
  - 200 with a schema-invalid body → `invalid`;
  - `requestId` copied from the `X-Request-ID` header;
  - the request URL is `${CATALOG_API_URL}/api/v1${path}` and `cache: "no-store"` is passed;
  - a caller-supplied `signal` is used instead of the default 3000 ms one (paging shares one deadline, FR-011).
- [X] T017 [P] Write `tests/unit/api-paginate.test.ts` (fails first):
  - total ≤ 100 → one call;
  - total 250 → page 1 first, then pages 2 and 3 requested **concurrently** (assert both started before either resolved), results concatenated in page order;
  - any page failing → throws;
  - **one 3 s budget per resource** (FR-011): every page call receives the same `AbortSignal`. With fake timers, page 1 answering at 2500 ms and page 2 hanging → `timeout` at 3000 ms total, not 5500 ms.
- [X] T018 Create `src/lib/api/config.ts` (`import "server-only"`):
  - `getApiBase()` returns a validated `http(s)` origin without a trailing slash, or `null`. It reads `process.env.CATALOG_API_URL` at call time, not module load, so tests can change it.
  - `getClinicFallback()` parses and validates `CLINIC_FALLBACK_JSON` with `ClinicSettingsSchema`. It returns `null` when the value is missing or invalid; an invalid value logs one `console.warn` with no value echoed.
  - `getDataRevalidateSeconds()` returns `CATALOG_DATA_REVALIDATE_SECONDS` when it is an integer from 1 to 3600, else 300 (one `console.warn` when set but invalid). It is only for the stateful e2e server; production leaves it unset.
  - Add unit cases for all three functions to `tests/unit/api-http.test.ts`.
- [X] T019 Create `src/lib/api/http.ts` (`import "server-only"`): `class ApiError` and `getJson(path, schema, signal?)` per contracts/data-access.md §2–3, with `fetch(url, { cache: "no-store", signal: signal ?? AbortSignal.timeout(3000), headers: { accept: "application/json" } })`. This is the only `fetch` call in `src/`. Make T016 pass.
- [X] T020 Create `src/lib/api/paginate.ts`: `getAllPages(path, itemSchema)` with `pageSize=100`. It creates **one** `AbortSignal.timeout(3000)` and passes it to page 1 and to pages 2..n (fetched via `Promise.all`), so a whole list never takes more than 3 s. Make T017 pass.
- [X] T021 Write `tests/unit/api-cached.test.ts` (fails first). Mock `next/cache` so `unstable_cache(fn, key, opts)` records `key`/`opts` and simulates Next's semantics with an in-memory map: when there is no entry, run `fn` and store it on success (rethrow on failure); when there is an entry, run `fn`, store it on success, and return the stale value on failure. Assert:
  - each of the 7 loaders uses key `["api", <resource>]`, `revalidate: 300` and tags `["catalog", <resource>]` when `CATALOG_DATA_REVALIDATE_SECONDS` is unset, and `revalidate: 3` when it is `"3"` (re-import the module after setting the variable);
  - after one success, later failures still return the first data (last good);
  - with no success ever, it throws.
- [X] T022 Create `src/lib/api/cached.ts` (`import "server-only"`) with the 7 `unstable_cache` loaders from data-model §4: `cachedClinic` (`getJson("/clinic", ClinicSettingsSchema)`) and `cachedClinicRules`, `cachedDepartments`, `cachedDoctors`, `cachedLabTestCategories`, `cachedLabTests`, `cachedHealthPackages` (`getAllPages`). Each loader's `revalidate` is `getDataRevalidateSeconds()`. Export a `CATALOG_REVALIDATE = 300` constant for documentation; route segments still write the literal `300`, because Next requires it to be static. Make T021 pass.
- [X] T023 Write `tests/unit/api-load.test.ts` (fails first): `load(name, fn)` returns `{ok:true,data}` on success; maps `ApiError` `unconfigured` → `{ok:false,reason:"unconfigured"}` and everything else → `"unavailable"`; never throws, even on a non-ApiError; logs exactly one `console.warn` JSON line `{"event":"catalog_api_unavailable","resource":name,"kind":...,"requestId":...}` with no URL, query or body.
- [X] T024 Create `src/lib/api/load.ts` (`import "server-only"`) with `type Loaded<T>` and `load()`. Make T023 pass.
- [X] T025 [P] Create `src/components/ui/DataUnavailable.tsx` (server component). Compose the existing `EmptyState` from `src/components/ui/EmptyState.tsx` with no new styles. Props `{ title?: string; phone?: PhoneNumber }`. Copy: "This information is temporarily unavailable", "Please try again in a few minutes.", a "Try again" link to the current path (prop `href`), and "Call the clinic" `tel:` when `phone` is given, else a link to `/contact`. Add `tests/unit/data-unavailable.test.tsx`: renders the text, a working retry link, a phone link when given and a contact link when not, and no technical words ("error", "500", "fetch", "API").

### 2d. Mock API and e2e harness (contracts/mock-api.md)

- [X] T026 Create `tests/mock-api/server.mjs` (Node `http` only). It serves the 7 endpoints from `tests/fixtures/api/*.json` with `page`/`pageSize` slicing and `X-Request-ID`.
  - Modes `ok|down|slow|error500|malformed|partial|extra|rename|rules-empty|rebrand` (contracts/mock-api.md), controlled by `POST /__mode` (`{mode, resources?}`), `GET /__mode` and `POST /__reset`.
  - The starting mode comes from `MOCK_API_MODE` (default `ok`); `__reset` returns to `ok`.
  - **Request log**: `GET /__log` returns the number of catalog requests per resource since the last `__reset`. Stateful specs use it to prove the API was really called after a mode switch.
  - Port `MOCK_API_PORT` defaults to 4010. A `GET /` health response lets Playwright wait for it.
  - `slow` waits 60 s but must stop when the client disconnects.
- [X] T027 Add `tests/unit/mock-api.test.ts`: start the server on a random port. Check that `ok` responses match the fixtures and the paging envelope, that each mode has the documented status/behaviour, that `MOCK_API_MODE` sets the starting mode, that `__log` counts per resource, and that `__reset` restores `ok` and clears the log.
- [X] T081 Per-server build folders (C5). In `next.config.ts`, set `distDir: process.env.NEXT_DIST_DIR || ".next"` (read the `distDir` page in `node_modules/next/dist/docs/` first). Add `.next-*` to `tsconfig.json` `exclude`, to the ESLint ignores in `eslint.config.mjs` and to `.gitignore` (T006). `npm run build` with the variable unset must still write to `.next`.
- [X] T028 Update `playwright.config.ts` (main):
  - make `webServer` an array: (1) `node tests/mock-api/server.mjs` at `http://127.0.0.1:4010/`; (2) the existing Next command with `env: { CATALOG_API_URL: "http://127.0.0.1:4010", CLINIC_FALLBACK_JSON: <stringified tests/fixtures/api/clinic.json> }`;
  - add `testIgnore: ["**/stateful/**", "**/offline/**"]` (C4);
  - keep `fullyParallel: true`. Main specs never change the mock mode.
  - Add `tests/e2e/mock-api.ts` with helpers `setMode(apiBase, mode, resources?)`, `resetMode(apiBase)` and `requestLog(apiBase)`, for stateful specs only.
- [X] T082 Create `playwright.stateful.config.ts` (C1–C3):
  - `testDir: "./tests/e2e/stateful"`, `workers: 1`, `fullyParallel: false`, one project (Desktop Chrome);
  - `webServer` array, all with `reuseExistingServer: false`:
    - (1) mock on 4011;
    - (2) `next dev --port 3300` with `NEXT_DIST_DIR=.next-stateful`, `CATALOG_API_URL=http://127.0.0.1:4011`, `CATALOG_DATA_REVALIDATE_SECONDS=3` and `CLINIC_FALLBACK_JSON`;
    - (3) a **cold** mock on 4012 with `MOCK_API_MODE=partial`;
    - (4) `next dev --port 3301` with `NEXT_DIST_DIR=.next-stateful-cold` pointed at 4012. Its command first deletes `.next-stateful-cold` (`node -e "require('fs').rmSync('.next-stateful-cold',{recursive:true,force:true})"`), so its data cache always starts empty.
  - `baseURL` is 3300; specs that need the cold server set `test.use({ baseURL: "http://localhost:3301" })`.
  - A `test.beforeEach` in `tests/e2e/stateful/fixtures.ts` calls `resetMode` on 4011.
  - Add `tests/e2e/stateful/cache-guard.spec.ts`, which proves the design works and must pass before any other stateful spec is trusted. In `ok` mode:
    - open `/doctors` twice within 1 s → `__log` shows 1 `doctors` request (the data cache is active in dev);
    - wait 4 s and open it twice more → `__log` shows at least 2 (the refresh reaches the API).
  - If either check fails, **stop and report to the user**: the stateful design does not hold.
- [X] T029 Create `playwright.offline.config.ts`: `testDir: "./tests/e2e/offline"`, Desktop Chrome and Pixel 7. Two variants, each with its own build folder so the two builds never share `.next` (C5):
  - **dead**: `npm run build && npm run start -- --port 3200` with `NEXT_DIST_DIR=.next-offline-dead`, `CATALOG_API_URL=http://127.0.0.1:9` and `CLINIC_FALLBACK_JSON`; projects `dead-*` match `site.spec.ts`;
  - **unset**: port 3201, `NEXT_DIST_DIR=.next-offline-unset`, with `CATALOG_API_URL` and `CLINIC_FALLBACK_JSON` both unset; projects `unset-*` match `unset.spec.ts`.

**CHECKPOINT 2**: `npm run typecheck`, `npm run lint` and `npm test` all pass (new api-* tests green, drift suite proves detection). `npm run test:e2e` passes unchanged against the mock server (pages still read the shims). `npm run test:e2e:stateful` runs `cache-guard.spec.ts`. Until US1 rewires pages, that spec is expected to fail with "0 doctors requests"; record this as the expected red state. Report the unit test count delta.

---

## Phase 3: User Story 1 — Visitors see the clinic's live catalog (P1) 🎯 MVP part 1

**Goal**: Every catalog page reads departments, doctors, schedules, lab test categories, lab tests and packages from the API, looking exactly as today; records added after the build appear.

**Independent test**: with the mock API in `ok` mode, all existing e2e specs and the visual baseline pass (main config). On the stateful server, the `rename` mode shows the new doctor name everywhere within about 10 s (3 s data window), and a doctor added with `extra` opens at `/doctors/<new-slug>`.

### Tests for US1 (write first; they must fail)

- [X] T030 [P] [US1] Rewrite `tests/unit/data.test.ts`, `tests/unit/public-data.test.ts`, `tests/unit/filters.test.ts`, `tests/unit/format.test.ts`, `tests/unit/packages.test.ts`, `tests/unit/images.test.ts`, `tests/unit/routes.test.ts`, `tests/unit/pages.test.ts`, `tests/unit/doctor-browser.test.tsx`, `tests/unit/lab-test-browser.test.tsx` and `tests/unit/home-sections.test.tsx` to import sample data from `tests/fixtures/catalog/*` instead of `@/data/*`. Do not change any assertions; only imports and any random-ID equality setup.
- [X] T031 [P] [US1] Create `tests/unit/content-api.test.ts`: mock `@/lib/api/cached` with the fixtures and test each `src/lib/content.ts` accessor in data-model §6. Cover sort orders, the featured clamp 3–4, `getLabTestsBySlugs` order with unknown slugs skipped, and `getPackagesIncludingTest`. The `load*` variants return `{ok:false}` when the cached loader throws, and `get*` helpers return `[]`/`undefined` in that case. Dangling references (spec edge case, U1):
  - a doctor whose `departmentId` matches no department in the list is still listed, with no department label or link, and does not crash `getDoctorsByDepartment`;
  - a package whose test slugs include one missing from the lab-test list renders the other tests, skips the missing one silently and shows no empty entry.
- [X] T032 [P] [US1] Update the e2e specs that import data (`tests/e2e/helpers.ts`, `about.spec.ts`, `contact-faq.spec.ts`, `health-packages.spec.ts`, `health-tips.spec.ts`, `lab-tests.spec.ts`, `legal.spec.ts`) to import from `tests/fixtures/catalog/*`.
- [X] T033 [P] [US1] Create `tests/e2e/stateful/new-record.spec.ts` (stateful config; mode `extra` from T026 appends doctor `dr-test-new` in the first department):
  - open `/doctors` in `ok` mode;
  - `setMode("extra")` and wait 4 s;
  - `expect.poll` for up to 10 s that `/doctors/dr-test-new` returns 200 with the name visible, and that `/doctors` lists it;
  - `__log` shows a `doctors` request after the switch;
  - `/doctors/does-not-exist` returns 404.
- [X] T083 [P] [US1] Create `tests/e2e/stateful/rename.spec.ts` (U2, US1 scenario 2; mode `rename` from T026 changes the first featured doctor's `fullName` to "Dr Renamed Test"):
  - in `ok` mode, open `/`, `/doctors`, `/doctors/<slug>` and `/departments/<that doctor's department>`, and read the old name;
  - `setMode("rename")` and wait 4 s;
  - `expect.poll` for up to 10 s that every one of those pages shows "Dr Renamed Test" and none shows the old name;
  - `__log` shows a `doctors` request after the switch.

### Implementation for US1

- [X] T034 [US1] Rewrite `src/lib/content.ts` catalog accessors to read from `@/lib/api/cached` via `load` (keep the same exported names and semantics; add `loadDepartments`, `loadDoctors`, `loadLabTestCategories`, `loadLabTests`, `loadHealthPackages` returning `Loaded<T>`). Keep editorial accessors (tips, about, FAQ, legal) reading `src/data/*` unchanged. Keep the file header comment updated (remove the "Phase 2 will…" note). Make T031 pass.
- [X] T035 [US1] `src/app/doctors/page.tsx` + `src/components/doctors/*` server parents: use `Promise.all([loadDoctors(), loadDepartments()])`; on `!ok`, render `DataUnavailable` in the list section only (heading/intro/page header unchanged). Add `export const revalidate = 300`.
- [X] T036 [US1] `src/app/doctors/[slug]/page.tsx`: `dynamicParams = true`, `revalidate = 300`. `generateStaticParams` uses `getDoctors()` (returns `[]` when unavailable). The page uses `loadDoctors()`: `!ok` → `DataUnavailable` inside the normal page shell (never `notFound()`); `ok` but slug missing → `notFound()`. Update `generateMetadata` the same way (unavailable → generic title, not 404).
- [X] T037 [P] [US1] `src/app/doctors/[slug]/opengraph-image.tsx`: import from `@/lib/content` instead of `@/data/doctors`; `generateStaticParams` returns `[]` when unavailable; unknown or unavailable → the generic site OG image from `src/lib/og.tsx` (never throw).
- [X] T038 [US1] `src/app/departments/page.tsx` and `src/app/departments/[slug]/page.tsx` (+ `src/components/departments/DepartmentSections.tsx` parent data): same pattern as T035/T036, with `Promise.all` for department + doctors-by-department + related lab tests. A department page shows its sections even if a related resource is unavailable (that section gets `DataUnavailable`).
- [X] T039 [P] [US1] `src/app/departments/[slug]/opengraph-image.tsx`: same as T037.
- [X] T040 [US1] `src/app/lab-tests/page.tsx` (+ `LabTestBrowser` parent): `Promise.all([loadLabTests(), loadLabTestCategories()])`; `!ok` → `DataUnavailable` in place of the browser; `revalidate = 300`.
- [X] T041 [US1] `src/app/lab-tests/[slug]/page.tsx`: same pattern as T036; related departments and "included in packages" sections each degrade independently.
- [X] T042 [P] [US1] `src/app/lab-tests/[slug]/opengraph-image.tsx`: same as T037.
- [X] T043 [US1] `src/app/health-packages/page.tsx`: `Promise.all([loadHealthPackages(), loadLabTests()])`; `!ok` packages → `DataUnavailable`; tests unavailable → packages render with the test names hidden (no crash); `revalidate = 300`.
- [X] T044 [US1] Home `src/app/page.tsx` and `src/components/home/DepartmentGrid.tsx`, `FeaturedDoctors.tsx`: load in parallel at the page level (no component-level sequential awaits); each section shows `DataUnavailable` independently; `revalidate = 300`. Do not change the hero/facts/why/tips editorial sections.
- [X] T045 [US1] `src/app/sitemap.ts` and `src/lib/pages.ts`: catalog URLs come from `get*` helpers (unavailable → the static and editorial URLs only; never throw); add `export const revalidate = 300` to the sitemap.
- [X] T046 [US1] Find every remaining import: `rg "@/data/(departments|doctors|labTests|healthPackages)" src` must return nothing. Fix any stragglers by moving them to `@/lib/content`.
- [X] T047 [US1] Delete the shims `src/data/departments.ts`, `src/data/doctors.ts`, `src/data/labTests.ts`, `src/data/healthPackages.ts`. Run `npm run typecheck`.

**CHECKPOINT 3 (US1)**: `npm run typecheck && npm run lint && npm test && npm run test:e2e && npm run test:e2e:stateful` all pass, including `visual-baseline.spec.ts` with **zero** screenshot diffs (siteConfig still served by its shim), and the stateful `cache-guard`, `new-record` and `rename` specs. The build output shows catalog routes as static/ISR (`○`/`●` with revalidate 5m), not dynamic `ƒ`; paste the route table into `results.md`.

---

## Phase 4: User Story 2 — The site never breaks when the API is slow, asleep or down (P1) 🎯 MVP part 2

**Goal**: Build passes without the API; warm pages keep last good data; cold pages show friendly fallbacks within the time budget; outages never 404.

**Independent test**: `npm run test:e2e:offline` passes (both variants), and `npm run test:e2e:stateful` passes `resilience.spec.ts` for every mock mode and `partial-cold.spec.ts`.

### Tests for US2 (write first; they must fail where behaviour is missing)

- [ ] T048 [P] [US2] Create `tests/e2e/stateful/resilience.spec.ts` (stateful config, 3 s data window). For each mode `down`, `slow`, `error500` and `malformed`, for the routes `/`, `/doctors`, `/doctors/<slug>`, `/departments/<slug>`, `/lab-tests`, `/lab-tests/<slug>` and `/health-packages`:
  - open the route in `ok` (loads the data and compiles the route), `resetMode` to clear the log, `setMode(mode)`, wait 4 s (past the data window), then request it 3 times;
  - `__log` shows at least one request for the route's resource after the switch, so the failure path really ran (C1);
  - each response has status 200 and arrives in < 4000 ms (`Date.now()` around `page.goto`);
  - the previously visible doctor/test name is still present (last good);
  - no "temporarily unavailable" text;
  - no console errors on the client.
- [ ] T049 [P] [US2] Create `tests/e2e/stateful/partial-cold.spec.ts` with `test.use({ baseURL: "http://localhost:3301" })`. This is the cold server, started in `partial` mode with an empty data cache (T082), and no other spec uses it. Open `/departments` as the first request ever: the page returns 200, header/footer render, and `DataUnavailable` appears in the departments section only. Then open `/doctors`: the doctors render (only departments fail).
- [ ] T050 [P] [US2] Recovery (SC-005). Route segment `export const revalidate` must be a static literal in Next, so the e2e check uses the stateful server's 3 s data window instead. Prove recovery in three places:
  - (a) Unit: extend `tests/unit/api-cached.test.ts`. After failures, when the next loader call succeeds, the new data replaces the last good value.
  - (b) E2E: in `tests/e2e/stateful/resilience.spec.ts`, open `/doctors` in `ok`, `setMode("down")`, wait 4 s, open it, then `setMode("rename")`, wait 4 s, and `expect.poll` for up to 10 s that "Dr Renamed Test" appears.
  - (c) Manual: covered in T075. Stop the backend for over 5 minutes while the production site runs, restart it, and confirm fresh data within about 5 minutes; record the timing in `results.md`.
  Do **not** add a test-only revalidation endpoint.
- [ ] T051 [P] [US2] Create `tests/e2e/offline/site.spec.ts` (offline config, dead-host variant) for every public route:
  - status 200, with header, footer, navigation and demo notice visible;
  - the demo notice text equals "Portfolio demo — not a real clinic, not medical advice.";
  - the footer shows the credit "Designed & built by Shuaib Ali" with `href="https://github.com/Shuaibali0786"` (constitution I, K2);
  - catalog sections show "temporarily unavailable";
  - the emergency number from the fallback JSON is visible in the header/emergency card;
  - `/doctors/any-slug` → 200 with `DataUnavailable` (not 404);
  - axe has no serious or critical violations on `/` and `/doctors`.
- [ ] T052 [P] [US2] Create `tests/e2e/offline/unset.spec.ts` (unset-URL variant, no fallback JSON): status 200; pages render with a neutral identity; no `tel:` links; the same demo notice text and credit text/`href` checks as T051 (K2).
- [ ] T053 [P] [US2] Create `tests/unit/no-api-url-in-client.test.ts`: for every production build folder that exists (`.next/static`, `.next-offline-dead/static`, `.next-offline-unset/static`), scan every file for `127.0.0.1:4010`, `127.0.0.1:4011`, `127.0.0.1:4012`, `localhost:8000`, `CATALOG_API_URL`, `CATALOG_DATA_REVALIDATE_SECONDS` and `CLINIC_FALLBACK_JSON`. Any hit fails (SC-006). Skip with a clear message when no build exists. Also add the same scan as a step in `playwright.config.ts` `globalSetup` (`tests/e2e/global-setup.ts`) so it always runs after the e2e build.

### Implementation for US2

- [ ] T054 [US2] Make every catalog route render its never-loaded state through `DataUnavailable` (audit T035–T045 against T049/T051). Pass `phone={siteConfig.emergencyPhone}` where a phone is known.
- [ ] T055 [US2] Make `generateMetadata` in all `[slug]` pages, `src/app/layout.tsx` metadata and `src/lib/seo.ts` safe when data is unavailable: generic titles from the clinic name, no throw, no `notFound()` on outage.
- [ ] T056 [US2] Verify the build without the API: run `set CATALOG_API_URL=http://127.0.0.1:9 && npm run build`, then `set CATALOG_API_URL= && npm run build`; both must succeed. Record the build durations in `results.md` and make sure no build step waits longer than about 3 s per resource (if it does, check the timeout wiring in `http.ts`).
- [ ] T057 [US2] Make T048–T053 pass. Any fix goes in `src/lib/api/*` or the page that failed; do not raise the timeout above 3 s.

**CHECKPOINT 4 (US2)**: `npm test`, `npm run test:e2e`, `npm run test:e2e:stateful` (incl. resilience and partial-cold) and `npm run test:e2e:offline` (both variants) pass; the API URL scan is clean. **MVP (US1+US2) is shippable here.** Report to the user.

---

## Phase 5: User Story 3 — Clinic identity and rules come from data (P2)

**Goal**: Header, footer, notice bar, contact details, hours, metadata, OG images and robots use API clinic settings, with the FR-022 precedence. Rules appear as "Before your visit". The logo file exists.

**Independent test**: on the stateful server, switch the mock to `rebrand` (different name, emergency number and an extra rule). Within about 10 s every place shows the new values while the demo notice and credit stay unchanged. In the main config, the visual baseline is unchanged apart from the rules list.

### Tests for US3 (write first)

- [ ] T058 [P] [US3] Create `tests/unit/site-config.test.ts` for the `getSiteConfig()` precedence:
  - API ok → API values;
  - API failing with no last good and a valid fallback JSON → fallback;
  - invalid fallback → neutral identity (`name: "Clinic"`, no phones, `demoNotice: DEMO_NOTICE`, `credit: CREDIT` from `src/lib/honesty.ts`) plus one warn;
  - live data is never replaced by the fallback when last good exists.
- [ ] T059 [P] [US3] Update `tests/unit/header.test.tsx`, `tests/unit/footer-and-notice.test.tsx`, `tests/unit/map-embed.test.tsx` and `tests/unit/honesty.test.ts` to supply clinic data via the mocked content layer or props (fixtures from `tests/fixtures/catalog/siteConfig.ts`). Keep the assertions; add one case each where phones are absent (neutral identity) that asserts no `tel:` link and no crash.
- [ ] T060 [P] [US3] Create the rules specs (modes `rules-empty` and `rebrand` come from T026):
  - `tests/e2e/rules.spec.ts` (main config, `ok` only): `/contact` and `/book-appointment` show a "Before your visit" heading and 5 rules, in fixture order; axe is clean on both pages.
  - `tests/e2e/stateful/rules-modes.spec.ts` (C2). For each mode: open the pages in `ok`, switch mode, wait 4 s, `expect.poll` for up to 10 s, and assert through `__log` that `clinic`/`clinic-rules` were requested after the switch.
    - `rules-empty` → no "Before your visit" heading;
    - `rebrand` → new name in header/footer/`<title>`, new emergency number, 6 rules, and the demo notice and credit text/`href` **unchanged** (K1).
- [ ] T084 [P] [US3] Honesty text is fixed by the constitution, not by data (K1).
  - Create `src/lib/honesty.ts` exporting `DEMO_NOTICE = "Portfolio demo — not a real clinic, not medical advice."` and `CREDIT = { text: "Designed & built by Shuaib Ali", href: "https://github.com/Shuaibali0786" }`, with a comment citing constitution Principle I.
  - `src/components/layout/NoticeBar.tsx`, `SiteFooter.tsx` and `src/lib/og.tsx` render these constants, not `siteConfig.demoNotice`/`siteConfig.credit`.
  - Extend `tests/unit/honesty.test.ts`:
    - the constants equal the constitution text;
    - `tests/fixtures/api/clinic.json` `demoNotice`/`credit` equal the constants (seed parity, so a seed edit is caught);
    - the footer and notice bar render the constants even when the clinic data carries different values.
- [ ] T061 [P] [US3] Create `tests/unit/logo-mark.test.ts`: `public/images/brand/logo-mark.svg` exists and parses as XML; the root `<svg>` has a `viewBox`, a `<title>` and `role="img"`; its `<path d>` values equal those exported from `src/components/brand/logo-paths.ts`; it has no `<image>`, external `href` or `<script>`; size < 4 kB.

### Implementation for US3

- [ ] T062 [US3] Implement `getSiteConfig()` in `src/lib/content.ts` with the precedence from data-model §5 (`load("clinic", cachedClinic)` → `getClinicFallback()` → the neutral constant defined in `src/lib/content.ts`, which uses `DEMO_NOTICE` and `CREDIT` from T084), and add `getClinicRules()` (sorted, `[]` when unavailable). Delete the `src/data/siteConfig.ts` shim. Make T058 pass.
- [ ] T063 [US3] Update every former `siteConfig` importer to `await getSiteConfig()` in a server context: `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/opengraph-image.tsx`, `src/app/robots.ts`, `src/lib/og.tsx`, `src/lib/seo.ts`, `src/lib/pages.ts`. Make `seo.ts`/`og.tsx` helpers take `SiteConfig` as a parameter instead of importing it. Add `revalidate = 300` where the route is static (layout segment, robots, root OG image).
- [ ] T064 [US3] `src/components/contact/MapEmbed.tsx` (client): take `mapArea` and `address` as props; update its server parent in `src/app/contact/page.tsx`. Make the header, footer, notice bar and emergency card (`src/components/layout/SiteHeader.tsx`, `SiteFooter.tsx`, `NoticeBar.tsx`, `src/components/home/EmergencyCard.tsx`) hide phone UI cleanly when phones are absent (neutral identity). This is a conditional render only, with no style changes.
- [ ] T065 [US3] Create `src/components/contact/BeforeYourVisit.tsx` (server component, props `rules: ClinicRule[]`, returns `null` when empty). Use the existing `SectionHeading` and the list markup/classes from `src/components/about/VisitSteps.tsx`, with no new CSS tokens or classes beyond existing utilities. Render it on `src/app/contact/page.tsx` and `src/app/book-appointment/page.tsx` below the main content and above the footer CTA. Add `tests/unit/before-your-visit.test.tsx` (order, empty → nothing, list semantics `<ol>`).
- [ ] T066 [US3] Create `public/images/brand/logo-mark.svg` (64×64 `viewBox`, `role="img"`, `<title>` = "Logo mark") from the path data in `src/components/brand/logo-paths.ts` and the brand tokens `#0B2545`/`#14B8A6` already used by `LogoMark.tsx`. Add `scripts/build-logo-svg.mjs` to generate it so the file and component cannot drift. Make T061 pass. Do not change `LogoMark.tsx`.
- [ ] T067 [US3] Use `siteConfig.logo` (when present) as the `logo` in organisation structured data / metadata in `src/lib/seo.ts`; otherwise keep today's behaviour.
- [ ] T068 [US3] Run `rg -n "Shuaib Health|\+92 21 0000|0000 0000" src`. Only the neutral-identity constant and comments may remain; there must be no sample clinic values in `src/` (FR-002). Add this as `tests/unit/no-hardcoded-catalog.test.ts`: walk `src/`, fail on the sample clinic name, sample phone, or any sample doctor `fullName`/lab test `name` from the fixtures.
- [ ] T069 [US3] Update the visual baseline only for `/contact` and `/book-appointment` (the rules list is the one approved addition, SC-009) with `npx playwright test visual-baseline -g "contact|book-appointment" --update-snapshots`. All other snapshots must still match unchanged.

**CHECKPOINT 5 (US3)**: unit, e2e (incl. rules + visual), stateful e2e (incl. rules-modes) and offline e2e all pass; the no-hardcoded-catalog test is green; report the visual diff summary to the user.

---

## Phase 6: User Story 4 — Developers can trust the connection (P2)

**Goal**: Drift is caught, config is per-environment and server-only, and the suite runs without a real API. Most mechanics exist from Phase 2; this phase closes the gaps and proves them.

**Independent test**: rename a field in a scratch copy of the contract → `npm test` fails naming it; `npm test` and `npm run test:e2e` pass with no backend running.

- [ ] T070 [P] [US4] Add `tests/unit/server-only-boundary.test.ts`: every file in `src/lib/api/` except `schema.gen.ts` and `schemas.ts` starts with `import "server-only"`; no file under `src/components/` imports `@/lib/api`; no `"use client"` file imports `@/lib/content` or `@/lib/api`; `process.env.CATALOG_API_URL` / `CLINIC_FALLBACK_JSON` / `CATALOG_DATA_REVALIDATE_SECONDS` appear only in `src/lib/api/config.ts`.
- [ ] T071 [P] [US4] Add `tests/unit/single-fetch.test.ts`: `fetch(` appears in `src/` only in `src/lib/api/http.ts` (excluding comments).
- [ ] T072 [US4] Run the whole suite with the backend stopped (`npm test`, `npm run test:e2e`, `npm run test:e2e:stateful`, `npm run test:e2e:offline`) and record the result in `results.md` (SC-008).
- [ ] T073 [US4] Manually prove drift detection: copy `specs/003-catalog-api/contracts/openapi.yaml` to a temp file, rename `Doctor.fullName`, point the test at it via `OPENAPI_CONTRACT_PATH` (support that variable in `tests/unit/api-contract.test.ts`, defaulting to the real path), run `npm test`, and paste the failing message into `results.md`. Revert.

**CHECKPOINT 6 (US4)**: all checks green; drift demo recorded.

---

## Phase 7: Polish & Proof

- [ ] T074 Lighthouse after the change (same method as T003) on `/`, `/doctors`, `/lab-tests`, `/health-packages` with the mock API in `ok` mode; record in `results.md` beside the baseline. Each page's performance must be ≥ baseline and ≥ 90 mobile, and LCP within +10% (SC-003). Investigate any regression before continuing. Record in `results.md` that Lighthouse is run by hand in this feature. Automated Lighthouse budgets (constitution VIII) move to the deploy feature, where CI first exists (accepted finding K6, plan "Accepted analysis findings").
- [ ] T075 [P] White-label demo against the real backend (SC-001): with the backend running and seeded, change the clinic name, one doctor name, one lab test price and one rule in the dev database (SQL in `results.md`); wait ≤ 6 min with `npm run start`; record screenshots/notes; then re-seed to restore. Also run the T050(b) recovery check: stop the backend for more than 5 min, restart it, and measure the time until fresh data appears.
- [ ] T076 [P] Update `frontend/README.md`: data now comes from the API; env vars; `api:types`, `api:record`, `mock-api` and `test:e2e:offline` scripts; resilience behaviour in 5 lines; link to `specs/004-catalog-api-integration/quickstart.md` and ADR-0004. Update the root `README.md` feature list.
- [ ] T077 [P] Update `backend/README.md` "Frontend parity" note: the seed source moved to `frontend/tests/fixtures/catalog/` (via `scripts/catalog-object.mjs`).
- [ ] T078 Complete `specs/004-catalog-api-integration/results.md` with evidence for SC-001…SC-010 (test names, numbers, screenshots, route table) and FR coverage notes for any FR not covered by an automated test.
- [ ] T079 Final gate (constitution merge gate):
  - `npm run typecheck && npm run lint && npm test && npm run test:e2e && npm run test:e2e:stateful && npm run test:e2e:offline && npm run build` all green;
  - **secret scan** (K5): from the repo root, `gitleaks detect --source . --no-banner --redact` reports no leaks (install with `winget install Gitleaks.Gitleaks` if it is missing). Paste the summary line into `results.md`;
  - `git status` clean apart from intended changes; no `.env.local` and no `.next-*` folder committed.
- [ ] T080 Create the green-stage PHR under `history/prompts/004-catalog-api-integration/` summarising the implementation phases.

**CHECKPOINT 7**: final summary to the user (what shipped, evidence, follow-ups: migrate `unstable_cache` → `use cache` (ADR-0004), flip seed authoring to the backend, warm-up on deploy).

---

## Dependencies & Execution Order

```text
Phase 1 Setup ─▶ Phase 2 Foundational ─▶ Phase 3 US1 ─▶ Phase 4 US2 ─▶ MVP
                                       └▶ Phase 5 US3 (after US1: shares content.ts and page files)
                                       └▶ Phase 6 US4 (after Phase 2; T072 after US1–US3)
                                                         ─▶ Phase 7 Polish
```

- **US1 → US2**: US2 tests exercise the pages US1 rewires. US2 is P1 and required before shipping (constitution V).
- **US3 after US1**: both edit `src/lib/content.ts` and several pages; doing them in sequence avoids conflicts. US3 does not depend on US2.
- **Within phases**: tests before implementation; `config.ts` → `http.ts` → `paginate.ts` → `cached.ts` → `load.ts`; T007 before T014/T030/T032; T012 (recorded fixtures) before T013/T014/T026; T026 + T081 before T028, T029 and T082; T082 before every `tests/e2e/stateful/` spec (T033, T048–T050, T060, T083); T084 before T062.
- **Task IDs T081–T084** were added during analysis remediation. They sit in the phase where they run, not in numeric order.

## Parallel Opportunities

- **Phase 1**: T002, T003 and T006 together.
- **Phase 2**: T013, T014 and T015 (contract tests) together; T016 and T017 together; T025 alongside 2c; T026 + T027 alongside 2c.
- **US1**: T030, T031, T032, T033 and T083 can be written together (the stateful specs run serially); the OG image tasks T037, T039 and T042 together, after T034.
- **US2**: T048–T053 (all tests, separate files) can be written together.
- **US3**: T058–T061 and T084 together; T065 and T066 together.
- **US4**: T070 and T071 together.
- **Polish**: T075, T076 and T077 together.

### Parallel example (US1 tests)

```text
T030 rewrite unit-test imports     │ T031 content-api.test.ts
T032 e2e imports                   │ T033 stateful/new-record.spec.ts
T083 stateful/rename.spec.ts       │
```

## Implementation Strategy

1. **MVP = Phases 1–4 (US1 + US2)**: the site reads the live catalog and survives outages. siteConfig still comes from the shim, so identity is unchanged. This is shippable.
2. **Increment 2 = Phase 5 (US3)**: white-label identity, rules and logo.
3. **Increment 3 = Phase 6 (US4)**: proof and guard rails.
4. **Phase 7**: performance proof, docs, evidence.

Stop at every CHECKPOINT and report before continuing.

## Format Validation

All 84 tasks (T001–T084) use `- [ ] T### [P?] [US?] description + path`. Setup/Foundational/Polish tasks carry no story label; every Phase 3–6 task carries exactly one. The constitution phase label (Phase 2 — Backend) applies to the whole file and is stated once in the header.
