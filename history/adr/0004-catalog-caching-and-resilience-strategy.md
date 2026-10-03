# ADR-0004: Catalog Caching and Resilience Strategy (Website Data Access)

> **Scope**: Document decision clusters, not individual technology choices. Group related decisions that work together (e.g., "Frontend Stack" not separate ADRs for framework, styling, deployment).

- **Status:** Proposed (amended 2026-10-03 after `/sp.analyze`: time budget, honesty text, dependencies, e2e harness)
- **Date:** 2026-10-03
- **Feature:** 004-catalog-api-integration
- **Context:** The public website (Next.js 16.3.7 App Router, Cache Components off) must stop using hard-coded catalog and clinic data and read it from the Feature 003 API, so a clinic is white-labelled by data alone. The API runs on a host that sleeps when idle (~50 s cold start) and may be down. Constitution V requires that the build never depends on the API and that pages degrade gracefully. The user requires: last good data on failure, about 5-minute freshness matching the API's `Cache-Control: max-age=300`, no request waterfalls, unchanged speed and design, a server-only API URL, and a typed client that fails tests on contract drift. Reading the Next 16.3.7 source showed that plain `fetch` caching cannot meet "last good data". It caches only 200 responses, and during ISR regeneration it refetches in the foreground and throws on failure (`patch-fetch.js` L696, L801, L927–973). `unstable_cache` returns the stale value when a refresh throws (`unstable-cache.js` L190–214).

<!-- Significance checklist: Impact ✔ (every page's data path, build behaviour, failure modes)
     Alternatives ✔ (fetch cache, use cache/cacheComponents, in-memory store, detail endpoints)
     Scope ✔ (cross-cutting: all routes, OG images, sitemap, tests, config) -->

## Decision

One server-only data-access layer (`frontend/src/lib/api/`) behind the existing `src/lib/content.ts`:

- **Cache boundary**: each of 7 resources (clinic, clinic rules, departments, doctors, lab-test categories, lab tests, health packages) is wrapped in `unstable_cache` with `revalidate: 300` and tags `["catalog", <resource>]`. The inner HTTP call is `fetch(..., { cache: "no-store" })`, so only one cache layer exists. *Amended:* the data-cache window is read from `CATALOG_DATA_REVALIDATE_SECONDS`, a **test-only** override (integer 1–3600; anything else means 300). Production leaves it unset, so production behaviour is unchanged at 300 s. Route-segment `revalidate` stays the literal `300`, as Next requires.
- **Last good data**: the loader **throws** on network error, timeout, non-200 or schema failure. `unstable_cache` then serves the stale value; a throw reaches the page only when nothing was ever cached.
- **Time budget**: one `AbortSignal.timeout(3000)` per resource. A paged list shares a single signal across all its pages, so a resource never takes more than 3 s in total (spec FR-011). Pages are static/ISR (`export const revalidate = 300`), so visitors get cached HTML immediately and regeneration happens in the background.
- **Graceful degradation**: a never-throwing `load()` returns `Loaded<T> = {ok:true,data} | {ok:false,reason}`. Pages render `DataUnavailable` (built on the existing `EmptyState`) **per section**, with HTTP 200. `notFound()` is called only when a successfully loaded list lacks the slug.
- **Clinic identity precedence**: live/last-good API value → `CLINIC_FALLBACK_JSON` (server env, zod-validated, used only when settings never loaded) → neutral identity with phones hidden. *Amended:* the demo notice and the author credit are constitution text. They are always rendered from constants in `src/lib/honesty.ts`, never from API or fallback data.
- **Request shape**: list endpoints only (`pageSize=100`, any further pages fetched in parallel); detail pages look records up by slug in the cached lists; independent resources load with `Promise.all`.
- **Build independence**: `generateStaticParams` uses the safe loader and returns `[]` when unavailable; catalog `[slug]` routes switch to `dynamicParams = true`, so records created after the build render on demand.
- **Configuration**: `CATALOG_API_URL` (origin; `/api/v1` appended) and `CLINIC_FALLBACK_JSON`, both read only in `config.ts` behind `import "server-only"`. Neither is `NEXT_PUBLIC_*`. An unset URL is treated as "unavailable", not as an error.
- **Typed contract**: `openapi-typescript` generates `schema.gen.ts` from `specs/003-catalog-api/contracts/openapi.yaml`, and zod validates at runtime. Five drift checks fail CI: regenerated ≠ committed; `z.infer` ≠ generated; generated not assignable to `types/content.ts`; fixture fails schema; recorded fixtures ≠ TS fixtures.
- **Test harness** (*amended*): a Node mock catalog server drives Playwright. Its modes are `ok | down | slow | error500 | malformed | partial | extra | rename | rules-empty | rebrand`. The starting mode comes from `MOCK_API_MODE`, and `GET /__log` returns per-resource request counts. The browser tests use three configs:
  - **Main** (`playwright.config.ts`): the production build with the mock in `ok` mode only. It never switches modes, so it runs fully parallel. It holds the visual baseline and existing specs.
  - **Stateful** (`playwright.stateful.config.ts`): one worker on `next dev` with `CATALOG_DATA_REVALIDATE_SECONDS=3`, plus a separate cold server that starts in `partial` mode with an emptied build folder. It runs the mode-switching specs (resilience, recovery, new record, rename, rules/rebrand). Production pages are ISR with a literal 300 s, so they never re-render within a test. `next dev` renders every request while still going through `unstable_cache`, so a switch really reaches the data layer. Every stateful spec asserts through `/__log` that the API was called after the switch. `cache-guard.spec.ts` must pass first, as proof that the data cache is active in dev.
  - **Offline** (`playwright.offline.config.ts`): production builds with the API dead or unset.
  - Each server builds into its own folder via `NEXT_DIST_DIR`, so concurrent builds never collide.

## Consequences

### Positive

- Meets "last good data" with a built-in, persistent cache (the incremental cache survives process restarts on the same deployment), and no extra infrastructure.
- No visitor waits for a sleeping API beyond 3 s, and normally not at all (stale-while-revalidate at the page level).
- The build is fully independent of the API; this is proved by the offline e2e config (Constitution V).
- About 7 API calls per 5-minute window per instance: far below the 60/min rate limit, no waterfalls, pages as fast as today.
- Outages never produce false 404s, half-rendered data, or leaked technical details.
- Tags allow instant invalidation (`revalidateTag("doctors","max")`) when an admin feature arrives.
- Contract drift between backend, committed OpenAPI and frontend is a closed, mechanically checked chain.
- All caching is in one module, so a later migration touches one file.
- Failure-path e2e tests cannot pass without reaching the API (request-log assertions), and parallel specs cannot disturb one another's mock mode or cache.

### Negative

- `unstable_cache` is marked "replaced by `use cache`" in Next 16. It is still supported without Cache Components, but it is a legacy API that a future upgrade must replace.
- A fresh deployment made while the API is asleep serves fallback sections until the API answers and the next regeneration runs (≤ ~5 min after wake-up). Mitigated only partly, by `CLINIC_FALLBACK_JSON`; a warm-up step belongs to the deploy feature.
- Freshness is eventual (up to ~5 min, plus one regeneration). Edits are not instant until on-demand revalidation is wired up.
- Fetching whole lists does not scale to very large catalogs (thousands of tests), which would need per-slug or search endpoints. Acceptable for a single clinic.
- **Tension with ADR-0002**: ADR-0002 rejected clinic config in environment variables. `CLINIC_FALLBACK_JSON` reintroduces a copy of clinic identity in deploy config. It is bounded strictly: emergency-only, never preferred over API data, and the database stays the source of truth. The operational cost is keeping it roughly in sync per clinic.
- **Seed direction not yet flipped**: catalog TS files move to `tests/fixtures/catalog/` and still feed `backend/app/seed/data/catalog.json` via the export script. The frontend repo therefore remains the authoring place for sample seed data (ADR-0002 negative #1 persists); moving authoring to the backend is a follow-up.
- Adds one dev dependency (`openapi-typescript`) and a test-only mock server to maintain. `server-only` is not installed: Next 16 resolves the import itself, and Vitest uses an empty stub.
- **Stateful specs run on `next dev`, not the production server.** They prove data-layer behaviour (stale-on-error, recovery, refresh). Production page-level ISR during an outage is covered by the main and offline configs and the manual recovery check (tasks T075), not by an automated mode switch.
- Two test-only environment variables (`CATALOG_DATA_REVALIDATE_SECONDS`, `NEXT_DIST_DIR`) exist in production code paths. Both default to production behaviour when unset, and the bundle scan checks that neither reaches the browser.
- The stateful config runs four servers (two mocks, two `next dev`). Running two dev servers from one project with separate build folders is not yet verified; `cache-guard.spec.ts` at checkpoint 2 is the gate.

## Alternatives Considered

- **A. `fetch` data cache (`next: { revalidate: 300, tags }`) + ISR keeping the last good page on throw** (the user's initial suggestion). It is simplest and idiomatic. Rejected: inside render you cannot tell build/first render (must not throw) from regeneration (must throw to keep the old page). Catching would cache a fallback page over a good one during an outage. Throwing breaks the build and first visits. The fetch cache also refetches in the foreground during regeneration and does not return stale data on error.
- **B. `'use cache'` + `cacheLife` + `cacheTag` with `cacheComponents: true`** (the Next 16 successor). It is future-proof, but it changes the rendering model of the whole app (segment `revalidate`/`dynamicParams`, every route audited), its stale-on-error behaviour is undocumented, and it is not the smallest change. Deferred to its own feature and ADR.
- **C. Custom last-good store (in-process `Map`, or Redis/KV)**. Full control. A `Map` is lost on every cold start or instance; KV adds infrastructure, cost and secrets before the deploy feature. Rejected.
- **D. Fully dynamic rendering (`no-store`, render per request) with a timeout**. Always fresh, but every visit waits on the API (up to the 3 s budget during cold starts), Lighthouse drops, and it gives no last-good behaviour. Rejected.
- **E. Detail endpoints per slug**. Smaller payloads, but 4× more cache entries and requests, and every detail page must separate 404 from an outage. Rejected for current catalog sizes.
- **F. Bundle the sample data as a build-time fallback**. The site always "works", but it contradicts the white-label requirement: another clinic's site would show the sample clinic during outages. Rejected (the user asked for its removal).
- **G. Hand-written client types only / full generated client (`openapi-fetch`)**. Hand-written types drift silently. A generated runtime client is unnecessary for 7 GETs. Rejected in favour of generated types plus zod.
- **H. One Playwright config with mode switches against the production server** (original plan). Rejected after analysis: ISR pages stay fresh for 300 s, so switches never reached the API and tests passed vacuously. The process-wide mock mode and Next cache also made parallel specs interfere.
- **I. Test-only revalidation endpoint, or forcing regeneration with Next's internal `x-prerender-revalidate` header**. Either would let the production server re-render on demand. Rejected: an endpoint adds a test-only surface to production, and the header depends on undocumented internals.

## References

- Feature Spec: [specs/004-catalog-api-integration/spec.md](../../specs/004-catalog-api-integration/spec.md)
- Implementation Plan: [specs/004-catalog-api-integration/plan.md](../../specs/004-catalog-api-integration/plan.md)
- Research: [research.md R1–R7, R11](../../specs/004-catalog-api-integration/research.md); Data model: [data-model.md §4–5](../../specs/004-catalog-api-integration/data-model.md); Contracts: [data-access.md](../../specs/004-catalog-api-integration/contracts/data-access.md), [mock-api.md](../../specs/004-catalog-api-integration/contracts/mock-api.md)
- Related ADRs: ADR-0002 (API contract and white-label data; see tension above), ADR-0003 (API HTTP caching: `max-age=300`, ETag)
- Evaluator Evidence: [history/prompts/004-catalog-api-integration/003-plan-catalog-api-integration.plan.prompt.md](../prompts/004-catalog-api-integration/003-plan-catalog-api-integration.plan.prompt.md); amendment: [006 analysis](../prompts/004-catalog-api-integration/006-analyze-spec-plan-tasks.misc.prompt.md), [007 remediation](../prompts/004-catalog-api-integration/007-remediate-analysis-findings.misc.prompt.md); plan Key Decisions 6–7
- Source checks (Next 16.3.7): `unstable-cache.js` L183–219 (stale value returned immediately and refreshed in the background during request renders); `app-render.js` L1656–1668 (pending revalidations go to `waitUntil` and do not hold the response); `docs/01-app/01-getting-started/05-server-and-client-components.md` L584–602 (`server-only` package optional)
