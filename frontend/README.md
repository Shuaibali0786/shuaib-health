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
npm run images:placeholders
```

Feature specs, plan and quickstart live in `..\specs\001-brand-home-page\`. Project rules are in `..\.specify\memory\constitution.md`.

## What changed in Feature 002 (public pages)

- New routes: `/about`, `/doctors` (+ 9 profiles), `/departments` (+ 7), `/lab-tests` (+ all tests), `/health-packages`, `/health-tips` (+ articles), `/contact`, `/faq`, `/privacy`, `/terms`. `/book-appointment` stays a holding page. Unknown paths return the friendly 404.
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
