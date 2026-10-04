# Research: Connect the Public Website to the Catalog API

**Feature**: 004-catalog-api-integration | **Date**: 2026-10-03
**Sources**: Next.js 16.3.7 docs and source in `frontend/node_modules/next` (per `frontend/AGENTS.md`), Feature 003 contract `specs/003-catalog-api/contracts/openapi.yaml`, constitution v-current.

---

## R1. How to keep "last good data" when the API fails

**Verified behaviour (Next 16.3.7 source):**

| Mechanism | On stale entry + API failure during ISR page regeneration | Evidence |
|---|---|---|
| `fetch(url, { next: { revalidate, tags } })` | Does a **foreground** refetch during static generation (`isForegroundRevalidate`); a network error **throws**, a non-200 is returned uncached. Stale data is **not** returned. | `next/dist/server/lib/patch-fetch.js` L696 (only `status === 200` cached), L801–802, L927–973 |
| `unstable_cache(fn, key, { revalidate, tags })` | Runs `fn` again; if it **throws**, the **stale cached value is returned** (`catch → return cachedResponse`), also in foreground revalidation. Throws only when there is **no** cached value. | `next/dist/server/web/spec-extension/unstable-cache.js` L190–214 |
| ISR page (`export const revalidate`) | If regeneration throws, the last successfully generated page keeps being served. | `docs/01-app/02-guides/incremental-static-regeneration.md` L467 |

**Decision**: Each catalog resource is loaded by a function wrapped in `unstable_cache` (`revalidate: 300`, tags per resource). Inside, the raw HTTP call uses `fetch(..., { cache: "no-store", signal: AbortSignal.timeout(3000) })`, and **throws** on network error, timeout, non-200 or schema-validation failure. A thin outer wrapper turns a throw into `{ ok: false }`; this only happens when no last good value exists (fresh start).

**Rationale**: This is the only built-in mechanism (without enabling Cache Components) that returns stale data when the refresh fails. The data cache lives in the Next incremental cache (filesystem on `next start`, platform data cache when hosted), so it survives process restarts on the same deployment. A `no-store` fetch inside an `unstable_cache` scope does not make the page dynamic (`dynamic-rendering.js` L212–221: `markCurrentScopeAsDynamic` is a no-op in `unstable-cache` scope), so pages stay static/ISR.

**User direction honoured**: the user asked for "fetch caching (revalidate 300s, tags per resource)". The 300 s revalidation and per-resource tags are kept, but they sit on `unstable_cache` rather than on `fetch`. Reason: `fetch` caching alone cannot serve last good data during regeneration (row 1 above). The user also asked to "serve the last good data when the API fails", and only this change satisfies both requests.

**Alternatives considered**:
- *`fetch` cache + let errors throw so ISR keeps the last page.* Rejected: the build and first render would also throw, and a fallback page caught inside render would be cached over a good page during an outage. Inside render you cannot tell "first render" from "regeneration".
- *`'use cache'` + `cacheComponents: true`* (the Next 16 successor to `unstable_cache`, see `unstable_cache.md` L7). Rejected for this feature: it changes the whole app's rendering model (route-segment `revalidate`/`dynamicParams` configs, every page audited). Its behaviour when a refresh fails is not documented, and it is not the smallest viable change. Recorded as a follow-up and an ADR candidate.
- *In-process `Map` as the last-good store.* Rejected as the primary store: it is lost on every cold start or instance. Not needed, given row 2.

**Risk**: `unstable_cache` is marked "replaced by `use cache`" in Next 16. It is still shipped and documented in the non-Cache-Components ISR guide. All caching goes through one module (`src/lib/api/cached.ts`), so a later migration touches one file.

## R2. Time budget for a sleeping API (~50 s cold start)

**Decision**: `AbortSignal.timeout(3000)` per resource. A single call uses its own 3 s signal; a paged list shares one signal across all its pages, so a resource never takes more than 3 s in total (FR-011, analysis A1). Pages are static/ISR (`export const revalidate = 300`), so visitors are served the cached page immediately; regeneration happens in the background (stale-while-revalidate). A visitor waits on the API only when they are the first ever to open a route (an on-demand dynamic slug). That wait is capped at 3 s, then the friendly message renders.

**Rationale**: Meets FR-011 / SC-004 (≤ 3 s per render, ≤ 4 s end-to-end). A timed-out regeneration keeps the stale data (R1). After the API wakes, the next regeneration picks up fresh data (SC-005).

**Alternatives**: a longer timeout (rejected: it ties up regeneration and makes first visitors wait); waking the API on a schedule (out of scope: deploy feature).

## R3. Pagination and request count

**Decision**: Use **list endpoints only** (7 resources: clinic, rules, departments, doctors, lab-test-categories, lab-tests, health-packages) with `pageSize=100`. If `total > 100`, fetch the remaining pages **in parallel** (not one after another). Detail pages find their record by slug in the cached list; "not found" means the slug is absent from a successfully loaded list.

**Rationale**: The contract (`openapi.yaml` L229–322) returns full items in lists, identical to detail shapes (the package detail only adds `tests`, which the site already derives from `testSlugs` + lab tests). So: 7 cache entries shared by every page, no per-slug requests, no waterfalls (FR-021), and ≤ 7 API calls per 5 minutes per instance, far below the 60/min limit. Outages never produce a false 404 (FR-014).

**Alternatives**: detail endpoints per slug (rejected: more requests and cache entries, plus a 404-vs-outage ambiguity on each one).

## R4. Dynamic routes and builds without the API

**Decision**: `generateStaticParams` reads slugs through the safe wrapper and returns `[]` when the API is unavailable. `dynamicParams` changes from `false` to `true` on `doctors/[slug]`, `departments/[slug]`, `lab-tests/[slug]` and their `opengraph-image` routes, and each gets `export const revalidate = 300`. Health tips are editorial and stay `dynamicParams = false`.

**Rationale**: The build never needs the API (FR-010). New records added after the build open on demand (FR-004). Unknown slugs still return a real 404 via `notFound()` when the list loaded fine.

## R5. Typed client and drift detection

**Decision**:
1. Generate TypeScript types from `specs/003-catalog-api/contracts/openapi.yaml` with **`openapi-typescript`** (devDependency) into the committed file `frontend/src/lib/api/schema.gen.ts` (`npm run api:types`).
2. Validate runtime responses with **zod** schemas (zod 4 is already a dependency) in `frontend/src/lib/api/schemas.ts`.
3. Contract tests (`tests/unit/api-contract.test.ts`):
   - regenerate types in memory and compare with the committed `schema.gen.ts` (fails on any drift; names the first differing line);
   - type-level checks (`expectTypeOf`) that `z.infer` of each zod schema equals the generated component type, and that each generated type is assignable to the existing content type in `src/types/content.ts` (FR-042);
   - every recorded fixture parses with its zod schema;
   - an injected-drift suite (removed field, renamed field, type change, newly required field) proves the check fails (SC-007).

**Path note**: the user referred to `backend/openapi.yaml`; the committed contract is `specs/003-catalog-api/contracts/openapi.yaml`, which the backend's `tests/unit/test_openapi_contract.py` already checks against the live app. Backend ↔ contract ↔ frontend is therefore a closed chain.

**Alternatives**: a hand-written client only (rejected: drift is invisible); a full generated client such as `openapi-fetch` (rejected: 7 GET calls don't justify a runtime dependency; we only need types).

## R6. Server-only configuration

**Decision**:
- `CATALOG_API_URL`: the API origin, e.g. `http://localhost:8000` (no `NEXT_PUBLIC_` prefix). The client appends `/api/v1`. Read only in `src/lib/api/config.ts`, which imports `server-only` so any client import fails the build.
- `CLINIC_FALLBACK_JSON`: the fallback clinic settings (Clarification Q2) as one JSON string, validated with the same zod `ClinicSettings` schema. Used only when clinic settings have never loaded. Missing or invalid means a neutral identity with phones hidden, plus `console.warn`.
- Unset `CATALOG_API_URL` is treated as "API unavailable" (the build still passes).
- `.env.example` documents both; local `.env.local` is git-ignored; preview/production values are set in the host (deploy feature).

**Test**: a production-build scan of `.next/static/**` for the configured URL finds 0 matches (SC-006).

## R7. Mocking the API in tests

**Decision**:
- **Unit (Vitest)**: `src/lib/api/http.ts` is the only module that calls `fetch`; tests stub `globalThis.fetch` with recorded fixtures (`tests/fixtures/api/*.json`) and mock `next/cache`'s `unstable_cache` as a pass-through plus an in-memory last-good map to simulate stale behaviour.
- **E2E (Playwright)**: Playwright cannot intercept server-side fetches, so a tiny Node **mock catalog server** (`tests/mock-api/server.mjs`) serves the fixtures with switchable modes: `ok | down | slow(60s) | error500 | malformed | partial`. It is controlled by `POST /__mode`. Playwright `webServer` starts it before `next build && next start`, with `CATALOG_API_URL` pointing at it.
- A separate Playwright config (`playwright.offline.config.ts`) builds and starts with `CATALOG_API_URL=http://127.0.0.1:9` (dead) to prove the build passes and pages show fallbacks (constitution V test).

**Fixtures**:
- The current `src/data/{departments,doctors,labTests,healthPackages,siteConfig}.ts` move unchanged to `tests/fixtures/catalog/`. `scripts/catalog-object.mjs` / `export-catalog.mjs` and `tests/unit/catalog-export.test.ts` are re-pointed there, so the backend seed keeps the same source and the existing test keeps passing.
- API response fixtures (`tests/fixtures/api/*.json`, real envelope shape with random IDs) are **recorded** from a locally seeded Feature 003 API by `npm run api:record` (`scripts/record-api-fixtures.mjs`) and committed.
- A unit test proves the recorded fixtures equal the TS fixtures field by field (by slug, ignoring `id` and reference values and the additive fields). This is the same rule as Feature 003 SC-001, so the fixtures cannot drift.

## R8. Logo mark asset

**Decision**: Create `frontend/public/images/brand/logo-mark.svg` (64×64 viewBox, `<title>`), drawn from the **same path data** as `src/components/brand/logo-paths.ts`, so it is identical to the in-site mark, original, and contains no third-party mark. A unit test asserts the SVG's paths equal `logo-paths.ts` and that it is a valid SVG with a title. The header keeps its inline `LogoMark` component (no visual change). The API `logo` field is used where an image URL is needed (metadata/structured data).

## R9. Friendly unavailable state and rules list (no new design)

**Decision**:
- Add `components/ui/DataUnavailable.tsx`, a composition of the existing `EmptyState` (same tokens). Its copy says the information is temporarily unavailable; it offers a "Try again" link to the same URL and the clinic phone, falling back to the generic contact page.
- Add `components/contact/BeforeYourVisit.tsx`, built from the existing `SectionHeading` + list styles used on the About/Visit steps. It renders nothing when there are no rules.

## R10. Performance

**Decision**: Pages remain static/ISR, so HTML is served from cache exactly as today and LCP is unchanged. No client bundle growth: the API code is server-only and zod runs on the server. Independent resources load with `Promise.all`. Lighthouse is measured before and after on `/`, `/doctors`, `/lab-tests` and `/health-packages` (mobile preset), and the results are recorded in `results.md` (SC-003).

## R11. ETag / Cache-Control from the API

**Finding**: Next's server-side caches do not send `If-None-Match`. The API's ETag/304 support (Feature 003 FR-070) therefore benefits browsers and other clients, not the website. Matching the API's 5-minute `max-age` with `revalidate: 300` keeps the website and API freshness windows aligned. No conditional-request logic is added (smallest change).
