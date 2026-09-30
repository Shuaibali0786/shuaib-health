# Route Contract: Feature 001

**Feature**: 001-brand-home-page | **Date**: 2026-09-30

This feature exposes no HTTP API. Its public contract is the set of browser routes below. The registry lives in `frontend/src/lib/routes.ts`; the header, footer, Home page links and tests all use it.

## Route table

| Path | Behaviour | Status | Linked from |
|------|-----------|--------|-------------|
| `/` | Real Home page (8 sections) | 200 | Logo, nav "Home", footer |
| `/about` | Coming soon | 200 | Nav, footer |
| `/doctors` | Coming soon | 200 | Nav, footer, hero "Find a Doctor", quick action |
| `/doctors/<slug>` | Coming soon (one per sample doctor) | 200 | Doctor card "View profile" |
| `/departments` | Coming soon | 200 | Nav |
| `/departments/<slug>` | Coming soon (one per department) | 200 | Department cards, footer Departments column |
| `/lab-tests` | Coming soon | 200 | Nav, quick action |
| `/health-packages` | Coming soon | 200 | Nav, quick action |
| `/health-tips` | Coming soon | 200 | Nav, Health Tips section "View all" link |
| `/health-tips/<slug>` | Coming soon (one per sample tip) | 200 | Tip cards |
| `/contact` | Coming soon | 200 | Nav, footer |
| `/book-appointment` | Coming soon | 200 | Header button, hero, quick action, CTA band, footer |
| `/home-sample-collection` | Coming soon | 200 | Quick action |
| `/privacy` | Coming soon | 200 | Footer bottom row |
| `/terms` | Coming soon | 200 | Footer bottom row |
| any other path | Friendly not-found page in the site layout | 404 | never linked |

`<slug>` values come from the mock data, so `/doctors/<slug>` is generated for each doctor, and likewise for departments and tips.

## Rules

1. **No dead links** (FR-024, SC-003): every internal `href` rendered by this feature is `/` or a path in the table. A unit test checks navigation data, footer data, home content and slug builders against the registry; the E2E crawler checks the rendered pages.
2. **Coming-soon page** contents: site layout (notice bar, header, footer), an `h1` "Coming soon", the page title (for example "Lab Tests"), one sentence saying this page is not built in the demo yet, a "Back to Home" button, and `noindex` metadata.
3. **Not-found page** contents: site layout, an `h1` "Page not found", a short apology, and a "Back to Home" button. It must never be linked from the site.
4. **Active navigation**: a nav link has `aria-current="page"` when the path equals its href, or, for section links, when the path starts with `href + "/"`. Home matches only `/`.
5. **Handover**: when a later feature adds a real page for a path (for example `app/about/page.tsx`), the path MUST be removed from the placeholder registry in the same change. A unit test fails if a registered placeholder also has a real page file.
6. **Non-navigation links**: `tel:` links for phone numbers, and one external link (`https://github.com/Shuaibali0786`) opening in the same tab with `rel="noopener noreferrer"`. External links are excluded from the internal crawl.
7. **Metadata**: page `<title>` uses the template "%s | Shuaib Health"; Home uses "Shuaib Health — Clinic & Diagnostics, Karachi". All pages send `robots: noindex, nofollow` while `siteConfig.indexable` is false.

## Acceptance checks

- [ ] Crawling every link from `/` returns 200 for all internal targets and none render "Page not found".
- [ ] `/definitely-not-a-page` returns 404 and shows the friendly not-found page inside the site layout.
- [ ] Each registered path renders the notice bar text exactly.
- [ ] `aria-current="page"` appears on exactly one nav link on `/`, `/doctors`, `/doctors/<slug>`.
