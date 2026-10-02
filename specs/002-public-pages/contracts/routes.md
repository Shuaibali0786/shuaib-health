# Route Contract: Feature 002

**Feature**: 002-public-pages | **Date**: 2026-10-02

No HTTP API is exposed. The public contract is the set of browser routes and the metadata files below. Paths are built by `frontend/src/lib/routes.ts`; titles and descriptions come from the page manifest `frontend/src/lib/pages.ts`.

## Route table (end state, after Phase D)

| Path | Page | Status | Static params |
|------|------|--------|---------------|
| `/` | Home (Feature 001) | 200 | — |
| `/doctors` | Doctors list with filters | 200 | — |
| `/doctors/<slug>` | Doctor profile | 200 | one per doctor (9) |
| `/departments` | Departments list | 200 | — |
| `/departments/<slug>` | Department page | 200 | one per department (7) |
| `/lab-tests` | Lab test catalog | 200 | — |
| `/lab-tests/<slug>` | Lab test page | 200 | one per test (≥ 24) |
| `/health-packages` | Health packages | 200 | — |
| `/health-tips` | Article list | 200 | — |
| `/health-tips/<slug>` | Article | 200 | one per article (6) |
| `/about` | About | 200 | — |
| `/contact` | Contact | 200 | — |
| `/faq` | FAQ (groups addressable as `#appointments`, `#lab-tests-reports`, `#payments`, `#home-sample-collection`, `#privacy`) | 200 | — |
| `/privacy` | Privacy | 200 | — |
| `/terms` | Terms | 200 | — |
| `/book-appointment` | "Booking coming soon" holding page | 200 | — |
| `/sitemap.xml` | Sitemap | 200 | — |
| `/robots.txt` | Robots | 200 | — |
| `/opengraph-image` and `/<family>/<slug>/opengraph-image` | Generated social image (PNG) | 200 | as above |
| any other path, including unknown slugs and `/home-sample-collection` | Friendly not-found page in the site layout | 404 | — |

Detail routes use `dynamicParams = false`.

## Rules

1. **No dead links**: every internal `href` rendered on any page is in the table (or a table path plus a `#fragment` listed above, or a query string on a list page). The unit test checks nav, footer, Home content, data-driven links and path builders against the manifest; the E2E crawler follows every internal link from every page.
2. **No "Coming soon" except booking**: once Phase D is complete the only page whose h1 is "Booking coming soon" is `/book-appointment`. Book buttons on doctor, department and Home pages link to it with no parameters.
3. **Breadcrumbs** on every page except Home:
   - `/doctors` → Home › Doctors; `/doctors/<slug>` → Home › Doctors › *Full name*
   - `/departments/<slug>` → Home › Departments › *Name*
   - `/lab-tests/<slug>` → Home › Lab Tests › *Test name*
   - `/health-tips/<slug>` → Home › Health Tips › *Title*
   - single-level pages (`/about`, `/contact`, `/faq`, `/privacy`, `/terms`, `/health-packages`, `/book-appointment`) → Home › *Page*
4. **Active navigation** is unchanged (`isActivePath`): `/doctors/<slug>` highlights Doctors, and so on.
5. **Handover rule from Feature 001 stays on**: while the catch-all exists, a path may not be both registered as a placeholder and have a real page. Each phase removes its own paths; the catch-all and the registry are deleted at the end of Phase D.
6. **Metadata**: the title template `%s | Shuaib Health` applies; entries store the short title. Every title and description in the manifest is unique; descriptions are 50–160 characters; each page sets a canonical URL and Open Graph and Twitter card fields from the manifest. While `siteConfig.indexable` is false, every page keeps `robots: noindex, nofollow`.
7. **Sitemap**: one `<url>` per manifest path (absolute, from `SITE_URL`, default `http://localhost:3000`), including all detail pages and excluding `/book-appointment` (holding page) — the manifest marks it `inSitemap: false`.
8. **Robots**: `User-agent: *` with `Disallow: /` while `indexable` is false (no `Sitemap` line is needed but one is emitted so the file is ready); when true: `Allow: /` and `Sitemap: <SITE_URL>/sitemap.xml`.
9. **Query parameters on list pages** (optional; absent means "all"): `/doctors?department=<department-slug>&q=<text>&day=<mon..sat>`, `/lab-tests?category=<category-slug>&q=<text>`, `/health-tips?category=<category-slug>`. Unknown values are ignored (treated as "all"), never an error.
10. **External requests**: none during load. The only external request is the OpenStreetMap frame on `/contact`, after the visitor presses "Show map". `tel:` links and the GitHub credit link are unchanged.

## Acceptance checks

- [ ] All 12 static paths and every detail path return 200 with one `h1`, the demo notice and (except Home) a breadcrumb.
- [ ] Each detail family returns 404 with the friendly page for an unknown slug; `/home-sample-collection` returns 404.
- [ ] Every manifest title and description is unique; sitemap URLs equal the manifest minus `inSitemap: false`.
- [ ] `/robots.txt` disallows all while the site is not indexable.
- [ ] The Home sample-collection quick action goes to `/faq#home-sample-collection` and that section exists.
- [ ] `npm run build` with no environment variables lists every static route and every detail path as prerendered.
