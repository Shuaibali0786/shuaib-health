# Implementation Plan: Connect the Public Website to the Catalog API

**Branch**: `004-catalog-api-integration` | **Date**: 2026-10-03 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/004-catalog-api-integration/spec.md`

## Summary

Replace the website's hard-coded catalog and clinic data with data from the Feature 003 API, without changing the design and without ever making the build or a page depend on the API being up.

Server components read through one server-only data-access layer:
- typed from the committed OpenAPI contract and validated with zod;
- each of the 7 list resources cached with `unstable_cache` (`revalidate: 300`, tags per resource), which returns the **last good value** when a refresh fails;
- a 3 s budget per resource, shared by all pages of a list, so a sleeping API never holds up a visitor;
- all pages static/ISR (`revalidate = 300`); dynamic slug routes switch to `dynamicParams = true`, so records added later work.

When no good data has ever loaded, the affected section shows a friendly "temporarily unavailable" state built from existing components. Clinic identity falls back to `CLINIC_FALLBACK_JSON`, so the emergency number stays visible. Clinic rules appear as "Before your visit" on Contact and Book Appointment. A mock API server drives the end-to-end tests through three Playwright configs:
- **main**: production build, mock in `ok` mode;
- **stateful**: one worker on `next dev` with a 3 s data-cache window, for down/slow/error/malformed/partial/rename/rebrand switches. Each switch is proven by the mock's request log.
- **offline**: production builds with the API dead or unset.

The demo notice and author credit are constitution text, rendered from constants and never from data.

## Technical Context

**Language/Version**: TypeScript 6 (strict), Node 24
**Primary Dependencies**: Next.js 16.3.7 App Router (Cache Components **off**), React 19.2, zod 4 (existing). One new dev dependency: `openapi-typescript` (type generation). There is no new runtime dependency: Next 16 resolves `import "server-only"` internally, and Vitest gets a stub alias.
**Storage**: Next incremental/data cache only; no new storage
**Testing**: Vitest + Testing Library (unit, contract, type tests); Playwright + axe (e2e) in three configs (main / stateful / offline, see Key Decision 6); Lighthouse (manual, see accepted finding K6)
**Target Platform**: Node server (`next start` locally; hosting decided in the deploy feature)
**Project Type**: Web application (`frontend/` + existing `backend/`); this feature changes `frontend/` only
**Performance Goals**: Home/listing pages unchanged from baseline (Lighthouse mobile ≥ 90 and ≥ baseline; LCP within +10%); ≤ 7 API calls per resource window per instance
**Constraints**: page render waits ≤ 3 s on the API (one budget per resource across its pages; resources load in parallel); build passes with the API unreachable; API URL server-only; no visual design changes; Sample labels unchanged
**Scale/Scope**: 7 API resources; about 14 routes and 4 OG image routes touched; 9 doctors / 7 departments / 26 tests / 5 packages in sample data (lists ≤ 100 fit in one page)

No NEEDS CLARIFICATION remain (resolved in spec Clarifications and [research.md](./research.md)).

## Constitution Check

*Pre-design and post-design: both PASS.*

- [x] **I. Honesty**: The demo notice and the "Designed & built by Shuaib Ali" credit are constitution text. They are rendered from constants in `src/lib/honesty.ts`, never from API or fallback data, so a data edit cannot remove or change them (data-model §5). A unit test pins the constants to the constitution text and checks seed parity. The offline and rebrand e2e specs assert the notice and the credit text/`href`. Sample badges are unchanged (FR-060); the existing honesty tests are kept.
- [x] **II. Privacy**: N/A to new endpoints. Read-only public data; logs carry no personal data or bodies (contracts/data-access §3).
- [x] **III. Server truth**: Prices, rules and schedules come from the API; the website computes none of them.
- [x] **IV. API-first**: The website consumes the same public API as future clients. Types come from the committed OpenAPI contract, and drift fails CI.
- [x] **V. Resilience**: Covered directly: build with the API unset/dead, last-good serving, friendly fallbacks, `playwright.offline.config.ts`.
- [x] **VI. Security**: No secrets; API URL server-only (`server-only` import guard + bundle scan); browsers never call the API, so CORS is unchanged.
- [x] **VII. Databases**: N/A (no DB access from the frontend).
- [x] **VIII. Design/a11y**: No token or design change. The two additions reuse existing components; axe runs on Contact/Book pages and on fallback states. Lighthouse runs by hand here; automated budgets move to the deploy feature (accepted finding K6).
- [x] **IX. Quality**: TS strict, no `any` (zod-inferred types), unit + contract + e2e tests, phased small diffs.
- [x] **X. Build order**: Connecting the frontend to the API follows backend Feature 003 and belongs to constitution **Phase 2 — Backend**; `tasks.md` carries that phase label in its header. Booking/admin/deploy are excluded.
- [x] **Merge gate**: The final gate (T079) runs typecheck, lint, unit, all three Playwright configs, build and a gitleaks secret scan.

## Project Structure

### Documentation (this feature)

```text
specs/004-catalog-api-integration/
├── spec.md
├── plan.md              # this file
├── research.md          # R1–R11 decisions
├── data-model.md        # source shapes, cache entries, state transitions
├── quickstart.md
├── contracts/
│   ├── data-access.md   # module boundaries, functions, error taxonomy, env, drift checks
│   └── mock-api.md      # test-only mock server
├── checklists/requirements.md
└── tasks.md             # /sp.tasks
```

### Source Code

```text
frontend/
├── .env.example                         # + CATALOG_API_URL, CLINIC_FALLBACK_JSON
├── next.config.ts                       # distDir from NEXT_DIST_DIR (one build folder per test server)
├── package.json                         # + api:types, api:record, test:e2e:offline, test:e2e:stateful; dev dep
├── playwright.config.ts                 # main: mock API (ok) + production next; ignores stateful/ and offline/
├── playwright.stateful.config.ts        # NEW: 1 worker, next dev, 3 s data window, warm + cold servers
├── playwright.offline.config.ts         # NEW: build/start with API dead/unset, separate build folders
├── public/images/brand/logo-mark.svg    # NEW
├── scripts/
│   ├── catalog-object.mjs               # re-pointed to tests/fixtures/catalog
│   └── record-api-fixtures.mjs          # NEW
├── src/
│   ├── app/                             # pages: load* + revalidate=300; [slug] routes dynamicParams=true
│   ├── components/
│   │   ├── ui/DataUnavailable.tsx       # NEW (wraps EmptyState)
│   │   ├── contact/BeforeYourVisit.tsx  # NEW
│   │   └── contact/MapEmbed.tsx         # receives clinic data via props
│   ├── data/                            # catalog + siteConfig files REMOVED (editorial files stay)
│   ├── lib/api/                         # NEW: config, schema.gen, schemas, http, paginate, cached, load
│   ├── lib/content.ts                   # reads lib/api; adds load* + getClinicRules
│   ├── lib/honesty.ts                   # NEW: DEMO_NOTICE + CREDIT constants (constitution I)
│   └── types/content.ts                 # additive: SiteConfig.logo/brandColors, slotMinutes, ClinicRule
└── tests/
    ├── fixtures/catalog/*.ts            # MOVED from src/data
    ├── fixtures/api/*.json              # NEW recorded responses
    ├── mock-api/server.mjs              # NEW
    ├── unit/                            # existing tests re-pointed + api-*.test.ts
    └── e2e/                             # existing + rules.spec.ts (main)
        ├── stateful/                    # cache-guard, resilience, partial-cold, new-record, rename, rules-modes
        └── offline/                     # site.spec.ts (dead host), unset.spec.ts (URL unset)
```

**Structure Decision**: Frontend-only change inside the existing `frontend/` layout. The backend and its contract are untouched.

## Key Decisions

1. **`unstable_cache` (not `fetch` cache) as the cache boundary.** Verified in Next source: it returns stale data when a refresh throws, which `fetch` caching does not (R1). Revalidation stays at 300 s with per-resource tags, as requested. → [ADR-0004](../../history/adr/0004-catalog-caching-and-resilience-strategy.md).
2. **List endpoints only; detail lookups from cached lists.** 7 cache entries, no waterfalls, no false 404s (R3).
3. **Types generated from the committed contract and runtime-validated with zod; four-layer drift check** (R5).
4. **Fallback clinic settings via `CLINIC_FALLBACK_JSON`** (Clarification Q2; data-model §5). Covered by ADR-0004, including its bounded tension with ADR-0002.
5. **Mock API server for e2e** (R7), since server-side fetches can't be intercepted by the browser.
6. **Three Playwright configs** (analysis C1–C5).
   - **Problem**: production pages are ISR with a literal `revalidate = 300`, so a page opened in a test never re-renders during the test. A mode switch would then never reach the API, and failure-path tests would pass without testing anything. The mock mode and Next's cache are also process-wide, so parallel workers would interfere.
   - **Design**:
     - **main** stays on the production build in `ok` mode (visual baseline, existing specs, rules list);
     - **stateful** runs one worker on `next dev`, which renders every request but still uses `unstable_cache`, with `CATALOG_DATA_REVALIDATE_SECONDS=3`. A separate cold server starts in `partial` mode with an empty cache;
     - **offline** builds production with the API dead or unset.
   - **Safeguards**: every stateful spec asserts through the mock's request log that the API was called after the switch. `cache-guard.spec.ts` must pass first, which proves the data cache is active in dev. Each server builds into its own `NEXT_DIST_DIR`.
   - **What `next dev` does not cover**: production page caching, which is covered by main, offline and the manual T075 check.
   - **Env variable**: `CATALOG_DATA_REVALIDATE_SECONDS` is test-only. Unset (production) means 300, as in ADR-0004.
7. **Honesty text from constants** (analysis K1). The demo notice and the credit are rendered from `src/lib/honesty.ts`. API values are only checked for parity in a unit test.

## Phases (each ends with a checkpoint: all listed checks green and a short summary to the user before continuing)

| Phase | Goal | Main work | Checkpoint (must pass) |
|---|---|---|---|
| **0. Baseline** | Record today's state | Run typecheck/lint/unit/e2e; Lighthouse mobile on `/`, `/doctors`, `/lab-tests`, `/health-packages`; screenshots of every route (visual baseline) → `results.md` | Baseline numbers + screenshots committed |
| **1. Contract & types** | Typed, validated client with drift detection, unused by pages yet | `openapi-typescript` (+ Vitest `server-only` stub); `api:types`; `schema.gen.ts`; zod `schemas.ts`; record fixtures; move catalog TS to `tests/fixtures/catalog` (keep `src/data` re-exporting temporarily); contract tests 1–5 + injected-drift tests | Unit + type tests green; drift suite fails as designed; no runtime change |
| **2. Data-access layer** | `http` → `paginate` → `cached` → `load` | 3 s timeout, `ApiError` taxonomy, parallel paging, `unstable_cache` with tags, `Loaded<T>`, clinic precedence + `CLINIC_FALLBACK_JSON`, server-only `config.ts`, `.env.example` | Unit tests: ok, down, timeout (fake timers), 500, 429, malformed, unconfigured, last-good after failure, fallback precedence, parallel paging |
| **3. Mock API + e2e harness** | E2E runs against the API shape | `tests/mock-api/server.mjs` (modes, `MOCK_API_MODE`, `/__log`); `NEXT_DIST_DIR`; main / stateful / offline Playwright configs | Existing e2e still green against mock server (pages still read `src/data` at this point — harness only); `cache-guard` red as expected until pages are rewired |
| **4. Switch pages to the API** | US1 + US3 identity | `content.ts` reads `lib/api`; `load*` in pages with section-level `DataUnavailable`; `revalidate = 300`; `[slug]` → `dynamicParams = true` with safe `generateStaticParams`; OG images, sitemap, robots, layout metadata, `MapEmbed` props; delete `src/data` catalog/siteConfig files; grep guard test (FR-002) | All existing unit + e2e green; visual diff vs Phase 0 = none; new-record-after-build e2e (mock adds a doctor → page opens) |
| **5. Resilience** | US2 | stateful `resilience.spec.ts` (load, then down/slow/500/malformed past the 3 s data window: data still shown, ≤ 4 s, 200, API call proven by `/__log`; recovery); stateful `partial-cold.spec.ts`; offline build e2e (unset + dead host; fallback UI; emergency number with fallback JSON; demo notice + credit; no false 404); bundle scan for API URL | Offline build passes; resilience specs green; 0 URL hits in any production `static` folder |
| **6. Rules + logo** | US3 rest | `BeforeYourVisit` on Contact + Book Appointment (omitted when empty/unavailable); `logo-mark.svg` from `logo-paths.ts` + test; types additive fields | Unit + e2e + axe green; visual diff shows only the rules list |
| **7. Polish & proof** | Done-done | Lighthouse vs baseline; README/quickstart; `results.md` (SC-001…SC-010 evidence); PHR | All SCs evidenced; typecheck, lint, unit, e2e, offline e2e, build all green |

## Risks (top 3)

1. **`unstable_cache` is legacy in Next 16.** Mitigation: it's isolated in `lib/api/cached.ts`; follow-up to evaluate `use cache` + `cacheComponents` in its own feature.
2. **A fresh deploy while the API is asleep shows fallback pages until the next regeneration (≤ 5 min after the API wakes).** Mitigation: `CLINIC_FALLBACK_JSON` keeps identity and emergency number; a warm-up step is handed to the deploy feature.
3. **Fixture drift between backend seed and frontend fixtures.** Mitigation: recorded-vs-TS fixture test and the existing `catalog-export` test close the loop.

## Complexity Tracking

No constitution violations.

- **Dependencies**: one new dev dependency (`openapi-typescript`) and **no new runtime dependency**. `server-only` is not installed: Next 16 handles the import itself (`node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md`, "installing `server-only` … is optional"). Vitest resolves it to an empty stub.
- **Test-only configuration**: `CATALOG_DATA_REVALIDATE_SECONDS` and `NEXT_DIST_DIR` exist only so e2e servers can run with a short data window and separate build folders. Production leaves both unset (300 s, `.next`).

## Accepted analysis findings

These findings from the 2026-10-03 `/sp.analyze` run were accepted rather than fixed:

- **K6 (Lighthouse budgets not automated, constitution VIII)**: there is no CI yet. Lighthouse runs by hand with fixed method and numbers recorded in `results.md` (T003/T074). Automated budgets move to the deploy feature, which introduces CI.
- **L1 (terminology drift: "service" vs "API", "friendly message" vs `DataUnavailable`)**: the spec is written for non-technical readers and the plan/tasks for implementers. In this feature, "catalog service" = the Feature 003 API, and "friendly unavailable message" = the `DataUnavailable` component.
- **L2 (logo "crisp at 32–512 px" not rendered in a test)**: the mark is a vector with a `viewBox` and no raster content (T061). That is accepted as evidence; no screenshot test is added.
- **L3 (temporary shims import from `tests/fixtures`)**: verified that `frontend/tsconfig.json` `include` (`**/*.ts`) covers `tests/fixtures/`. The shims exist only during Phases 2–3 and are deleted in T047/T062.
