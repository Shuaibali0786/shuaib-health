# Results: Feature 004 — Connect the Public Website to the Catalog API

Evidence log. Sections are filled in as tasks complete.

## Baseline

Recorded on branch `004-catalog-api-integration` (commit `80cf275`), before any Feature 004 code change. Machine: Windows 11, Node 24.13, run from `frontend/`.

| Command | Result | Duration |
|---------|--------|----------|
| `npm run typecheck` | pass | 19 s |
| `npm run lint` | pass, 0 warnings | 88 s |
| `npm test` (Vitest) | **475 passed** (475) | 77 s (87 s wall) |
| `npm run test:e2e` (Playwright, mobile + desktop, production build) | **953 passed**, 11 skipped | 6.5 min (399 s wall incl. build) |

Visual baseline (T002): `tests/e2e/visual-baseline.spec.ts` — 31 routes × 2 projects = **62 snapshots** under `tests/e2e/visual-baseline.spec.ts-snapshots/`. Generated with `--update-snapshots`, then re-run without it: 62/62 passed (stable, no flake).

## Baseline — Lighthouse

Method: `npm run build && npm run start -- --port 3150`, then
`npx lighthouse <url> --preset=perf --form-factor=mobile --output=json` ×3 per page, **median** reported.
Lighthouse's default simulated mobile throttling was used.

| Page | Performance (3 runs) | Median perf | LCP (ms) | TBT (ms) | CLS | JS transferred (kB) |
|------|----------------------|-------------|----------|----------|-----|---------------------|
| `/` | 43 / 45 / 46 | 45 | 4615 | 2433 | 0.000 | 165.3 |
| `/doctors` | 47 / 43 / 47 | 47 | 4131 | 3225 | 0.000 | 172.7 |
| `/lab-tests` | 53 / 41 / 56 | 53 | 3515 | 3423 | 0.000 | 159.7 |
| `/health-packages` | 42 / 44 / 55 | 44 | 4530 | 1951 | 0.000 | 151.9 |

**Caveat — read before using these as SC-003 targets.** Scores are far below 90 and TBT is in the seconds, which points at this development laptop being CPU-bound (Lighthouse simulates a slow phone on top of the host's speed) rather than at the site. Run-to-run spread is large (e.g. `/lab-tests` 41–56). T074 must therefore be run on the same machine under the same conditions and compared against these numbers ("≥ baseline"). The "≥ 90 mobile" part of SC-003 cannot be demonstrated on this hardware and needs a faster machine or CI.
JS kB is the sum of `Script` transfer sizes from Lighthouse's network-requests audit.

## Phase 3 — US1 live catalog (T030–T047)

Run from `frontend/` on branch `004-catalog-api-integration`, mock API in `ok` mode.

| Command | Result |
|---------|--------|
| `npm run typecheck` | pass |
| `npm run lint` | pass, 0 warnings |
| `npm test` (Vitest) | **583 passed** (45 files; baseline 475) |
| `npm run test:e2e` (main, production build against the mock API) | **1011 passed**, 11 skipped (same 11 as the baseline); `visual-baseline.spec.ts` **62/62, zero screenshot diffs**. First run had 4 failures in `doctors.spec.ts` (hard-coded `dept-*` ids); fixed with `departmentIdBySlug()` and re-run: 27/27 pass. |
| `npm run test:e2e:stateful` | **3/3 pass**: `cache-guard` (green now that pages read through the data cache), `new-record`, `rename` |

Route table (`npm run build`): every catalog route is `○` static or `●` SSG with **5m** revalidate (1y expire); no dynamic `ƒ` routes. `/`, `/doctors`, `/departments`, `/lab-tests`, `/health-packages`, `/sitemap.xml` are `○ 5m`; `/doctors/[slug]`, `/departments/[slug]`, `/lab-tests/[slug]` (and their `opengraph-image`) are `● 5m` with `dynamicParams = true`.

Notes on deviations from the task text:
- **Page manifest** (`src/lib/pages.ts`): the doctor, department and lab-test entries come from a `ManifestCatalog` argument (`getPageManifest(catalog)`, `knownPaths`, `isKnownPath`, `getManifestEntry`); without it only static and editorial pages are listed. Tests and e2e specs pass `fixtureCatalog` (`tests/fixtures/catalog/index.ts`). `sitemap()` is now async.
- **Facts band**: `facts` became `buildFacts(departmentCount)` because the department count is catalog data. With no count (API unavailable) a data-free fact ("Clinic + lab / Under one roof") stands in. Three test files switched from `facts` to `buildFacts(departments.length)`; the asserted values are unchanged.
- **Contract vs content types**: `ScheduleSession.day` widened to `Weekday` (the API allows Sunday); icon names are narrowed with `toIconName(name, fallback)` in `src/lib/content.ts`.
- **`summarizePackage`** keeps throwing for unknown tests by default; pages pass `{ skipMissing: true }` so live data with a dangling test slug renders the other tests (spec edge case).
- **Home** (T044): `DepartmentGrid` and `FeaturedDoctors` still load their own data (sibling async server components run concurrently and `React.cache` shares one load per render) so their unit tests render them unchanged; the page loads departments once more for the facts band.
- `rename.spec.ts` checks headings and links rather than all text: the mock changes `fullName` only, so the old name legitimately remains in the free-text bio.

## Phase 4 — US2 resilience (T048–T057)

| Command | Result |
|---------|--------|
| `npm run typecheck` | pass |
| `npm run lint` | pass, 0 warnings |
| `npm test` (Vitest) | **586 passed** (46 files) |
| `npm run test:e2e` (main) | **1015 passed**, 11 skipped; visual baseline 62/62; `globalSetup` bundle scan clean |
| `npm run test:e2e:stateful` | **9/9**: cache-guard, new-record, rename, partial-cold, resilience for `down`/`slow`/`error500`/`malformed`, recovery |
| `npm run test:e2e:offline` | **248 passed**, 2 skipped (both `test.fixme`, see below); dead-API and unset variants, desktop and mobile |

**T056 — builds without the API** (`NEXT_DIST_DIR=.next-build-check`, `CLINIC_FALLBACK_JSON` unset, run from `frontend/`):

| `CATALOG_API_URL` | Result | Duration |
|---|---|---|
| `http://127.0.0.1:9` (refused) | build succeeds | 50 s (includes compile and fonts) |
| empty (unset) | build succeeds | 14 s |

Both builds log one `catalog_api_unavailable` line per failed load (53 lines) and wait on nothing: a refused connection fails at once and an unset URL never calls `fetch`.

**What was added**
- Resilience: `getSiteConfig()` is API → validated `CLINIC_FALLBACK_JSON` → bundled sample, so the emergency number is always present; every catalog page and section passes that phone to `DataUnavailable` ("Call the clinic").
- Offline config now uses a fallback phone that differs from the recorded clinic (`tests/e2e/offline/fallback.ts`), so the offline spec proves the fallback was used.
- `tests/unit/no-api-url-in-client.test.ts` and `tests/e2e/global-setup.ts` scan `.next*/static` for the API URL and server-only variable names (SC-006).
- T055: `[slug]` pages already return generic titles on an outage (Phase 3); `layout.tsx` and `seo.ts` still read the bundled `siteConfig` until Phase 5, which cannot throw.

**Deviations and findings**
- `unset.spec.ts` has one `test.fixme` ("neutral identity, no `tel:` links"): it needs T062/T064 (Phase 5); the bundled sample clinic still supplies phones when nothing is configured.
- The offline `site.spec.ts` checks the menu button on phones (the nav only exists once opened).
- **Visual baseline is now deterministic.** The "Next available" label on doctor pages is computed in the browser from the current time, so the Phase 3 snapshots only matched when run near the time they were recorded (23 failures on a later run, only on the 16 pages that show doctors, both projects). The spec now fixes the browser clock (`page.clock.setFixedTime`, Monday 11:00 Karachi) and **32 snapshots were regenerated** (those 16 pages × 2 projects). Every other snapshot is unchanged; 62/62 pass.
- Stateful specs: an expired entry in the 3 s data cache is served once more while it refreshes, so `resilience.spec.ts` touches every route, waits, then checks. One earlier run hit `ERR_NETWORK_IO_SUSPENDED` (machine sleep), not a product failure; the clean re-run passed.
