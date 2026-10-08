# Shuaib Health — frontend

Portfolio demo website for a fictional clinic and diagnostic lab in Karachi. It is not a real clinic and gives no medical advice.

Next.js (App Router), TypeScript strict, Tailwind CSS v4. Requires Node 24.

Commands (run from this folder, Windows CMD friendly):

```bat
npm install
npm run dev
npm run lint
npm run typecheck
npm run test
npm run build
npm run test:e2e
npm run test:e2e:stateful
npm run test:e2e:offline
node scripts/check-admin-isolation.mjs
npm run images:placeholders
```

Feature specs, plan and quickstart live in `..\specs\001-brand-home-page\`. Project rules are in `..\.specify\memory\constitution.md`.

## What changed in Feature 002 (public pages)

- New routes: `/about`, `/doctors` (+ 9 profiles), `/departments` (+ 7), `/lab-tests` (+ all tests), `/health-packages`, `/health-tips` (+ articles), `/contact`, `/faq`, `/privacy`, `/terms`. `/book-appointment` was a holding page here; Feature 005 replaced it with the booking flow. Unknown paths return the friendly 404.
- Every page is listed in `src/lib/pages.ts` (the page manifest); metadata, the sitemap and the link and title tests all read it.
- Optional `SITE_URL` sets the base for canonical links, Open Graph and the sitemap (default `http://localhost:3000`). Crawlers are still asked to stay out (`siteConfig.indexable` is false).
- New dependencies: `react-hook-form`, `@hookform/resolvers` and `zod`, used only by the `/contact` form.

## Feature 004 (catalog data from the API)

Doctors, departments, lab tests, packages, the clinic identity, opening hours, rules and the logo now come from the catalog API (Feature 003) instead of bundled mock files. Quickstart: `../specs/004-catalog-api-integration/quickstart.md`. Decision record: `../history/adr/0004-catalog-caching-and-resilience-strategy.md` (ADR-0004).

Environment variables (server only, never sent to the browser; see `.env.example`):

| Variable | Purpose |
|----------|---------|
| `CATALOG_API_URL` | Base address of the catalog API, for example `http://localhost:8000`. Unset means "API unavailable". |
| `CLINIC_FALLBACK_JSON` | Optional clinic settings JSON, used only if the settings never loaded and the API is down. |
| `CATALOG_DATA_REVALIDATE_SECONDS` | Data-cache window, 1 to 3600 (default 300). Mostly for test servers. |

Scripts: `api:types` regenerates `src/lib/api/schema.gen.ts` from the OpenAPI contract; `api:record` records API responses into `tests/fixtures/api/`; `mock-api` starts the scripted mock API the tests use; `test:e2e:offline` runs the suite with no API at all.

Resilience in short:

- Pages are static or ISR and revalidate every 5 minutes; a changed record shows within about 6 minutes.
- If the API fails, the last good data keeps being served; a bad response never blanks a page.
- A section with no data at all shows "temporarily unavailable" with the clinic phone number; header, footer and demo notice always render.
- Builds succeed with the API down or `CATALOG_API_URL` unset.
- API responses are validated with zod; a malformed response counts as a failure and the API address never reaches a browser bundle.

## Feature 005 (online appointment booking)

Spec, plan and quickstart: `../specs/005-appointment-booking/`. Evidence for every success criterion: `../specs/005-appointment-booking/results.md`.

- **Routes.** `/book-appointment` (the step-by-step flow; `?doctor=` and `?department=` pre-select) and `/book-appointment/confirmed/[reference]` (the masked slip: PDF, calendar file, WhatsApp, print; never indexed, no referrer).
- **Same-origin proxy.** The browser only calls `/api/booking/slots/[doctorSlug]` and `/api/booking/appointments`. These server routes check `Origin`, content type and size, then call the backend with the shared secret, the visitor's IP and a request id (`src/lib/booking/backend.ts`, the only server-side booking `fetch`). Bodies are never logged.
- **`BOOKING_PROXY_SECRET`** (server only, at least 32 characters, must equal the backend's). `src/instrumentation.ts` makes `next start` refuse to start without it; `next build` does not need it, and in development it only logs an error.
- **Safe retries.** One `Idempotency-Key` per attempt; a double click or a retry after a timeout never books twice.
- **Mock API booking support** (`tests/mock-api`): `MOCK_NOW`, `MOCK_PROXY_SECRET`, and the modes `booking-down`, `booking-slow` (20 s), `slot-taken` and `rate-limited`. `/__log` lists booking calls (method, path, mode, idempotency key) and never a body.
- **Offline.** With the API dead or unset, the build passes and the booking page shows "Online booking is temporarily unavailable. Please call the clinic." with the clinic phone when known.

## Feature 006 (Clinic Command Centre)

Spec, plan, contracts and quickstart: `../specs/006-clinic-command-centre/`. Evidence for every success criterion: `results.md` there.

- **Routes.** `/admin/login`, `/admin` (Overview), `/admin/bookings`, `/admin/doctors`, `/admin/insights`, `/admin/activity` and `/admin/staff` (admins only), `/admin/account/password`. Public pages live in `src/app/(site)/`, the staff app in `src/app/(admin)/admin/` with its own root layout, CSS and fonts; staff code is in `src/admin/` and a lint rule stops public code importing it.
- **Isolation.** `npm run build && node scripts/check-admin-isolation.mjs` fails if any admin script, style or font is in a public page's bundle; `tests/e2e/admin-isolation.spec.ts` checks the same at runtime.
- **BFF.** The browser only calls `/api/admin/*` on this site. The server routes check origin and size, put the session token in a `__Host-` cookie (Secure, HttpOnly, SameSite=Strict) and call the backend with `BOOKING_PROXY_SECRET`; no new variable is needed. Every staff response sends `no-store`, `X-Robots-Tag: noindex`, `no-referrer` and `frame-ancestors 'none'` (`next.config.ts`); public pages never get these headers (`tests/unit/seo-indexing.test.ts`, `tests/e2e/seo.spec.ts`).
- **Demo.** `DEMO_ENABLED` (default `true`, read at build time, same name as the backend): the gold top bar, the demo buttons and `/admin/demo/start`. `false` removes them for a real clinic.
- **Search engines.** Public pages follow the clinic's `indexable` flag only (meta robots and `robots.txt`). The demo clinic is fictional, so it stays `noindex`; a real clinic sets `indexable` to true and its public pages become indexable, while `/admin` stays `noindex` and disallowed.
- **Tests.** Staff specs are `tests/e2e/admin-*.spec.ts` and run only in the projects `admin-desktop` (1440), `admin-laptop-1366`, `admin-laptop-1280` and `admin-mobile` (Pixel 7): `npm run test:e2e -- --project=admin-desktop`. `tests/e2e/stateful/admin-resilience.spec.ts` (`npm run test:e2e:stateful`) covers the staff backend down or slow. The mock API serves the staff API too (`tests/mock-api/admin.mjs`: test sessions such as `cs_e2e-admin`, `cd_e2e-demo`, and the modes `admin-down`, `admin-slow`, `session-expired`, `booking-changed`).
- **Visual baselines.** `tests/e2e/admin-visual.spec.ts` compares every screen in both themes with the approved design (`admin-visual.spec.ts-snapshots/`, Windows renders, clock frozen). After an intended design change, review the diff and update with `npm run test:e2e -- tests/e2e/admin-visual.spec.ts --update-snapshots`.
