# Implementation Plan: Public Pages

**Branch**: `002-public-pages` | **Date**: 2026-10-02 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/002-public-pages/spec.md`

**Note**: Phase 1 of the constitution build order (frontend, mock data). `/sp.plan` writes documents only; no packages are installed and no app code is written by it.

## Summary

Replace every Feature 001 "Coming soon" page with a real, honest, statically generated page: Doctors and Departments (P1), Lab Tests and Health Packages (P2), Health Tips, About, Contact, FAQ, Privacy and Terms (P3), plus one "Booking coming soon" holding page. Everything extends the Feature 001 shell, tokens, cards and typed content layer; all data stays in `src/data` behind async accessors in `src/lib/content.ts`. The pages make no network calls; the only client-side JavaScript added is small islands for filters, the "next available day", the contact form and the opt-in map.

Key technical decisions (alternatives in [research.md](./research.md)):

- **One page manifest** (`src/lib/pages.ts`) lists every public path with its title and description. Page metadata, the sitemap, the link-crawl tests and the uniqueness tests all read it, so "unique title and description" and "sitemap is complete" are one testable list.
- **Filters are client islands that start from a full server-rendered list.** Each list page renders every item on the server (works without JavaScript, no layout jump); a client component inside `<Suspense>` then applies filters kept in the URL query. The Suspense fallback is the same full list, which doubles as the loading state.
- **Real routes replace the catch-all.** The `[...slug]` placeholder route and the placeholder registry are deleted; detail routes use `generateStaticParams` with `dynamicParams = false`, so unknown slugs return the existing not-found page.
- **Contact form uses React Hook Form + Zod** (both already named in the constitution stack, first real use): the Zod schema is unit-testable and is the seed for the booking forms later. No request is made on submit.
- **FAQ uses native `<details>`/`<summary>`**: accessible state and keyboard behaviour for free, works without JavaScript.
- **Map is an opt-in `<iframe>`** of the key-less OpenStreetMap embed over the general Karachi area, shown only after a button press; text address always visible.
- **"Next available day"** is computed in the browser from the weekly schedule in Asia/Karachi, with a static "Available Mon, Wed, Fri" fallback in the server HTML.
- **Generated social images**: one brand card for the whole site and one per detail type (doctor, department, lab test, tip) rendered with the same generator already used for the touch icon; no new image files.

## Technical Context

**Language/Version**: TypeScript ~6.0.3 (strict, no `any`), Node.js 24, React 19.2, Next.js 16.3.7 (App Router) — unchanged from Feature 001
**Primary Dependencies**: existing (Tailwind 4, framer-motion `animate` for Reveal, lucide-react, `next/image`, `next/font`). **New, all in the constitution stack**: `react-hook-form` ^7.89, `zod` ^4.6, `@hookform/resolvers` ^5.9 (peer `zod ^3.25 || ^4`, `react-hook-form ^7.55`, both satisfied). Loaded only on `/contact`. Zustand stays uninstalled.
**Storage**: N/A (typed static data; nothing stored in the browser, no cookies; contact input lives in component state only and is discarded)
**Testing**: Vitest + React Testing Library (data, logic, components, guards) and Playwright + axe on mobile (393) and desktop (1280) projects, as in Feature 001
**Target Platform**: Modern evergreen browsers, mobile-first (320 px minimum); Vercel later
**Project Type**: web (monorepo; this feature touches `frontend/` only)
**Performance Goals**: LCP ≤ 2.5 s, INP ≤ 200 ms, CLS ≤ 0.1 on a mid-range mobile profile; filter result update ≤ 200 ms; `/contact` is the only route that adds a larger client bundle (form libraries, route-split); other new routes add islands ≤ 10 kB gzip each (checked from build output)
**Constraints**: zero backend/network calls at build or run time (single exception: opt-in map frame); build passes with no environment variables; no hex literals in components; reduced motion respected; WCAG 2.2 AA; Windows CMD-friendly scripts
**Scale/Scope**: 12 static routes (Home, `/doctors`, `/departments`, `/lab-tests`, `/health-packages`, `/health-tips`, `/about`, `/contact`, `/faq`, `/privacy`, `/terms`, `/book-appointment`) and 4 detail families → 9 + 7 + 24+ + 6 = 46+ detail pages; 9 doctors, 7 departments, ≥ 24 lab tests, 5 packages, 6 articles, ~20 FAQ items

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Verified against `.specify/memory/constitution.md` v1.0.0.

- [x] **I. Honesty — PASS.** Notice bar and credit remain in the root layout (every page, including not-found and booking-soon). Every doctor, price, package, article, address, phone, hour, FAQ answer and the map carries a visible sample/illustrative label (FR-003, FR-014). Extending Feature 001's text-scan to the new data and page text (forbidden words: rated, award, accredited, certified, JCI, ISO, "patients served", registration/PMDC numbers, real institution names) gates it. Doctor qualifications are generic degree titles only. Stock photos are captioned "Illustrative".
- [x] **II. Privacy — PASS (scope-limited).** No data is collected or stored; the contact form never sends or persists. Privacy page describes the real app's five roles and report access consistently with this principle and states the demo collects nothing. Verified by a test that blocks the network, a scan for storage APIs, and the absence of any `Set-Cookie`.
- [x] **III. Server truth — N/A now, prepared.** Fees and prices are labelled sample display values; package sums are derived from catalog prices, never typed. Times use Asia/Karachi explicitly; PKR formatting is the existing deterministic formatter.
- [x] **IV. API-first — PASS (prepared).** New shapes (schedule, lab test, package, article body) are API-shaped (ids, slugs, integer PKR, ISO dates with offset) and read only through `lib/content.ts` async accessors; no API is invented. The Zod schema for the contact form is the typed request shape for a future endpoint.
- [x] **V. Resilience — PASS.** No fetches. Static generation from in-repo data. A unit test scans `src` for `fetch(`, XHR and backend env names; CI-style check runs `npm run build` with an empty environment. Map failure degrades to text (edge case).
- [x] **VI. Security — PASS (scope-limited).** No secrets. `SITE_URL` (public, optional) is documented in a new `frontend/.env.example`. The opt-in iframe uses `referrerPolicy="no-referrer"` and a restrictive `sandbox`. CSP is Phase 4 and must then allow `frame-src https://www.openstreetmap.org` (recorded in research R7).
- [x] **VII. Databases — N/A.**
- [x] **VIII. Design/a11y — PASS.** Existing tokens only; accordion, tables, forms, breadcrumbs and filters follow WCAG 2.2 AA patterns (research R10); `next/image` for all photos, icons for categories and packages; reduced-motion respected (no new motion beyond the existing Reveal). Lighthouse CI budgets remain deferred to Phase 4 (Feature 001 Complexity Tracking); budgets verified manually per quickstart.
- [x] **IX. Quality — PASS.** Strict TypeScript, no `any`; unit tests for filters, schedule, pricing, search, validation, manifest and honesty; Playwright flows for each page family; small reviewable phases (below).
- [x] **X. Build order — PASS.** Phase 1 only: no backend, booking flow, login or staff app. The one new dependency group is within the constitution stack.

**Post-design re-check (after Phase 1 artifacts)**: still PASS. Design added no network access, no storage, and no dependency outside the constitution stack.

## Project Structure

### Documentation (this feature)

```text
specs/002-public-pages/
├── plan.md                  # This file
├── research.md              # Phase 0: decisions, rationale, alternatives, risks
├── data-model.md            # Phase 1: entities, rules, invariants, accessors
├── quickstart.md            # Phase 1: run, test, verify (Windows CMD)
├── contracts/
│   ├── routes.md            # Route table, static params, metadata, sitemap/robots, redirects
│   └── content-shapes.md    # TypeScript shapes for the new content (non-binding future API shapes)
├── checklists/
│   └── requirements.md      # Spec quality checklist
└── tasks.md                 # Phase 2 output (/sp.tasks — NOT created by /sp.plan)
```

No OpenAPI file: the feature exposes no endpoints and inventing one would break the "do not invent APIs" rule.

### Source Code (repository root)

New paths are marked `+`, changed paths `~`, deleted `-`.

```text
frontend/
├── .env.example                                   + SITE_URL placeholder (public, optional)
├── package.json                                   ~ add react-hook-form, zod, @hookform/resolvers
├── src/
│   ├── app/
│   │   ├── layout.tsx                             ~ metadataBase from SITE_URL
│   │   ├── loading.tsx                            + shared skeleton for route transitions
│   │   ├── sitemap.ts                             + from the page manifest
│   │   ├── robots.ts                              + honours siteConfig.indexable
│   │   ├── opengraph-image.tsx                    + site-wide brand card (inherited by static pages)
│   │   ├── [...slug]/page.tsx                     - deleted at the end of Phase D (shrinks per phase until then)
│   │   ├── book-appointment/page.tsx              + "Booking coming soon"
│   │   ├── about/page.tsx                         +
│   │   ├── contact/page.tsx                       +
│   │   ├── faq/page.tsx                           +
│   │   ├── privacy/page.tsx                       +
│   │   ├── terms/page.tsx                         +
│   │   ├── doctors/page.tsx                       +
│   │   ├── doctors/[slug]/page.tsx                +   (+ opengraph-image.tsx)
│   │   ├── departments/page.tsx                   +
│   │   ├── departments/[slug]/page.tsx            +   (+ opengraph-image.tsx)
│   │   ├── lab-tests/page.tsx                     +
│   │   ├── lab-tests/[slug]/page.tsx              +   (+ opengraph-image.tsx)
│   │   ├── health-packages/page.tsx               +
│   │   ├── health-tips/page.tsx                   +
│   │   └── health-tips/[slug]/page.tsx            +   (+ opengraph-image.tsx)
│   ├── components/
│   │   ├── layout/Breadcrumbs.tsx                 + nav > ol, aria-current on last item
│   │   ├── layout/PageHeader.tsx                  + h1, intro, optional sample note (inner pages)
│   │   ├── ui/EmptyState.tsx                      + message + "Clear filters" control
│   │   ├── ui/FilterBar.tsx                       + labelled search/select controls + live result count
│   │   ├── ui/Skeleton.tsx                        + token-based loading block (no animation under reduced motion)
│   │   ├── ui/icons.ts                            ~ add category and package icons
│   │   ├── home/DoctorCard.tsx                    ~ optional `detailed` variant (qualifications, languages, next day)
│   │   ├── home/TipCard.tsx                       ~ optional category + reading time
│   │   ├── doctors/DoctorBrowser.tsx              + client island (filters from URL)
│   │   ├── doctors/NextAvailable.tsx              + client: Karachi "today/tomorrow/Wed", server fallback text
│   │   ├── doctors/ScheduleTable.tsx              + semantic table
│   │   ├── departments/DepartmentDetail*.tsx      + sections (conditions, services, doctors, related tests)
│   │   ├── lab-tests/LabTestBrowser.tsx           + client island (search + category)
│   │   ├── lab-tests/LabTestCard.tsx, LabTestFacts.tsx +
│   │   ├── packages/PackageCard.tsx               + totals, included-test links
│   │   ├── tips/TipBrowser.tsx, ArticleBody.tsx   +
│   │   ├── about/VisitSteps.tsx                   +
│   │   ├── contact/ContactForm.tsx                + RHF + Zod, no network
│   │   ├── contact/MapEmbed.tsx                   + opt-in iframe, text fallback
│   │   ├── faq/FaqGroup.tsx                       + native details/summary
│   │   ├── legal/LegalPage.tsx                    + sections, last updated, demo note
│   │   └── coming-soon/ComingSoon.tsx             ~ reused only by /book-appointment (copy: "Booking coming soon")
│   ├── data/
│   │   ├── doctors.ts, departments.ts, healthTips.ts     ~ extended (new fields, 5 doctors, 2 tips)
│   │   ├── labTests.ts                            + categories + ≥ 24 tests
│   │   ├── healthPackages.ts                      + 5 packages (testSlugs + package price)
│   │   ├── faq.ts, aboutContent.ts, legalContent.ts, contactContent.ts   +
│   │   ├── siteConfig.ts                          ~ lab hours, map area
│   │   └── homeContent.ts                         ~ home-sample-collection link → /faq#home-sample-collection
│   ├── types/content.ts                           ~ new shapes (see contracts/content-shapes.md)
│   └── lib/
│       ├── content.ts                             ~ new async accessors
│       ├── pages.ts                               + page manifest (path, title, description, kind)
│       ├── seo.ts                                 + pageMetadata() helper (title, description, canonical, OG)
│       ├── routes.ts                              ~ real paths only; placeholder registry removed
│       ├── format.ts                              ~ export formatTime; add formatTimeRange, formatDayLong
│       ├── schedule.ts                            + nextAvailable(schedule, now), availableDays()
│       ├── filters.ts                             + filterDoctors, filterLabTests, filterTips, normalizeQuery
│       ├── packages.ts                            + summarizePackage() (sum, saving)
│       ├── readingTime.ts                         + minutes from article text
│       └── contactSchema.ts                       + Zod schema + phone normalisation
└── tests/
    ├── unit/                                      ~ updated + new files (see Test strategy)
    └── e2e/                                       ~ updated + new specs
```

**Structure Decision**: continue the Feature 001 web layout (`frontend/src`, `@/*` alias, tests in `tests/{unit,e2e}`), grouping new components by page family and keeping pure logic in `lib/` so it is unit-testable without React. Pages stay server components; only the islands listed above are `"use client"`.

## Design Overview

### Routing and static generation ([contracts/routes.md](./contracts/routes.md))
- Detail routes export `generateStaticParams` from the data and `dynamicParams = false`; unknown slugs return the existing 404 page, rendered in the site layout. The Feature 001 note about a harmless `NoFallbackError` server log for `dynamicParams = false` is re-verified on the new routes in Phase A; if the 404 renders correctly (status 404, layout, notice) it is accepted as before. Fallback if not: drop `dynamicParams = false` and call `notFound()` for missing data (research R2).
- `app/[...slug]` and the placeholder registry are deleted in the same change that adds the real pages for their paths, so no path is ever both. `/home-sample-collection` is removed (spec FR-012) when the Home link is retargeted in Phase A (dropped from the registry then), so it becomes a plain 404. `/book-appointment` is a real page whose h1 is "Booking coming soon".
- `src/lib/routes.ts` keeps `ROUTES`, path builders and `isActivePath`; `isKnownPath` is rebuilt from the manifest.

### Page manifest, metadata, sitemap ([contracts/routes.md](./contracts/routes.md))
- `lib/pages.ts` builds the manifest from `ROUTES` and the data arrays. `generateMetadata` on every page calls `pageMetadata(entry)`; titles use the layout template (`%s | Shuaib Health`), so entries store the short title. `sitemap.ts` maps the manifest to absolute URLs (base from `SITE_URL`, default `http://localhost:3000`); `robots.ts` returns `disallow: "/"` while `siteConfig.indexable` is false and the allow rule plus sitemap link when true. The root layout sets `metadataBase`.
- Open Graph: `app/opengraph-image.tsx` (static pages inherit it) plus one `opengraph-image.tsx` per detail family that prints the doctor, department, test or article title on the brand card. Static pages show their own title in `og:title`/`og:description`; the shared card is the image. (Spec Assumption "generated card with the page title" is met for detail pages; static pages use the site card.)

### Content layer ([data-model.md](./data-model.md))
- Existing records are extended, not copied: `Doctor` gains qualifications, experience, languages, bio and schedule; `Department` gains overview, conditions, services and related test slugs; `HealthTip` gains body blocks. New: `LabTestCategory`, `LabTest`, `HealthPackage`, `FaqGroup`, legal and about content.
- Derived values are computed, never stored: package sum and saving, reading time, "available days", next available day.
- Integrity is guarded by tests: every doctor→department, department→doctors (≥ 1), department→tests (≥ 3), package→tests, article→related, all slugs unique, every schedule inside clinic hours, every `isSample` true.
- Existing Feature 001 behaviour is preserved: `getFeaturedDoctors` still returns the original four (`isFeatured` stays true only for them); `getLatestHealthTips` still feeds Home (it shows the newest three; adding six articles keeps the newest-first ordering, so Home may now show the new articles if they are newer — new articles are dated older than the Feature 001 set so Home is unchanged).

### List pages with filters (P1, P2, P3)
- Pattern: server page → `<Suspense fallback={<FullList/>}><Browser items={…}/></Suspense>`. `Browser` is a client component: reads `useSearchParams`, filters with the pure functions in `lib/filters.ts`, updates the URL with `router.replace(..., { scroll: false })`, renders `FilterBar` (labelled controls, `role="status"` result count `aria-live="polite"`), the cards, or `EmptyState`. Back-navigation restores the filters because they are in the URL.
- Search normalisation (`normalizeQuery`): trim, collapse spaces, case-insensitive, strip a leading "Dr."/"Dr " token only when other text remains; compare to name (doctors) or name + also-known-as (tests). Special characters are matched literally (no regex built from input).
- Doctor filters combine: department (select), name (search), day (select Mon–Sat; matches doctors with a session that day).

### Doctor and department detail (P1)
- Profile: photo, name, specialty, qualifications, experience (labelled sample), languages, fee, `ScheduleTable` (`<table>` with caption "Weekly schedule (Asia/Karachi)", `<th scope="row">` days, multiple sessions per day joined), bio, department link, "Book appointment" button to `/book-appointment`. `NextAvailable` is a tiny client component: server HTML contains "Available Mon, Wed, Fri"; after mount it shows "Next: Today, 5 PM" style text computed by `lib/schedule.ts` from `Intl.DateTimeFormat(..., { timeZone: "Asia/Karachi" })` parts. Pure function takes `now` so tests cover midnight and Sunday.
- Department page: overview, conditions and services lists, doctors grid (reusing `DoctorCard`), related tests (reusing `LabTestCard`, compact), booking button. Conditions are headed "Common conditions (general list)".

### Lab tests and packages (P2)
- Catalog: `LabTestBrowser` with search and category chips (a `radiogroup` of buttons with visible selected state and counts; icons from `ICONS`). Each card shows the required fields and links to `/lab-tests/[slug]`.
- Test page: facts as a definition list, "Sample price" badge, packages that include it, related departments, short preparation note and "follow your doctor's instructions" line. No interpretation text (FR-046).
- Packages page: five `PackageCard`s (icon, who it is for, included tests as links, "Sum of individual tests", "Package price", "Difference", preparation, home collection). `summarizePackage` is the only place totals are computed; a unit test asserts sum and ordering for all five and a data test asserts every `testSlug` resolves.

### Content and trust pages (P3)
- Health tips: `TipBrowser` (category filter), `ArticleBody` renders typed blocks (`heading`, `paragraph`, `list`) so no raw HTML or markdown parser is needed; reading time from the block text; "General information, not medical advice" note component; related = same category first, then newest, excluding the current one, max 3.
- About: honest story, mission, values, illustrative photos (existing images, captions "Illustrative image"), numbered `VisitSteps` (`<ol>`).
- Contact: details block (sample address, tappable invalid sample phones, emergency note), hours table (clinic and lab rows), `MapEmbed`, `ContactForm`. Form: RHF with Zod resolver, `noValidate`, `aria-describedby` per field, an error summary (`role="alert"`, receives focus on failed submit) linking to fields, first invalid field focused, values retained; success `role="status"` with "Messages are not sent in this demo yet". No `fetch`, no storage.
- FAQ: five `<section id="…">` groups with `<h2>` and `<details>` items; ids match the group slugs (`appointments`, `lab-tests-reports`, `payments`, `home-sample-collection`, `privacy`).
- Privacy/Terms: `LegalPage` with a table of contents (anchor links), `<h2>` per required topic, last-updated date (`2026-10-02`, formatted by `formatKarachiDate`), demo and not-legal-advice notices at top.

### Honesty, accessibility, motion
- Notice and credit are untouched (layout). New content goes through the same `SampleBadge` and a new `IllustrativeNote` caption for stock photos: doctor profiles say "Stock photo of a model. Sample profile — name and details are fictional." (the photos are real models, so no text may say they are not real people), facility photos say "Illustrative image, not our actual facility.", and doctor photo alt text begins "Stock photo of a model presented as sample doctor …". Breadcrumbs, headings (one `h1` per page, in order), focus visibility, 24 px targets, status messages and reduced-motion follow research R10. No new animation is added; `Reveal` is reused for below-the-fold sections only.

### Requirement traceability

| Spec area | Primary implementation | Primary verification |
|-----------|-----------------------|----------------------|
| FR-001, FR-013 reuse | extended types/data/components | code review, `data.test` (no duplicate collections) |
| FR-002, FR-003, FR-014, FR-024, FR-061 honesty | layout, `SampleBadge`, `IllustrativeNote`, data | `honesty.test` (extended), E2E `honesty.spec` on every route |
| FR-004 PKR/Karachi | `format.ts`, `schedule.ts` | `format.test`, `schedule.test` |
| FR-005, FR-008 metadata, sitemap, robots | `pages.ts`, `seo.ts`, `sitemap.ts`, `robots.ts`, OG files | `pages.test` (unique), E2E `seo.spec` |
| FR-006 breadcrumbs | `Breadcrumbs` | component test, E2E per page family |
| FR-007 static, 404 | `generateStaticParams`, `dynamicParams=false` | E2E `links.spec` (unknown slugs), build output |
| FR-009 no calls, resilience | no fetch; opt-in map | guard test, E2E network-blocked spec |
| FR-010 loading/empty | `loading.tsx`, Suspense fallback, `EmptyState` | component + E2E |
| FR-011 a11y/motion | patterns in R10 | axe on every page, keyboard and reduced-motion E2E |
| FR-012 links | `homeContent.ts`, `routes.ts`, tests | `links.spec`, `routes.test` |
| FR-020–026 doctors | `DoctorBrowser`, profile page, `schedule.ts`, `filters.ts` | `filters.test`, `schedule.test`, `data.test`, E2E `doctors.spec` |
| FR-030–032 departments | department pages | `data.test`, E2E `departments.spec` |
| FR-041–049 lab tests, packages | `LabTestBrowser`, test page, `PackageCard`, `packages.ts` | `labtests.test`, `packages.test`, E2E `lab-tests.spec` |
| FR-050–053 articles | `TipBrowser`, `ArticleBody`, `readingTime.ts` | `tips.test`, E2E `health-tips.spec` |
| FR-060, FR-061 about | about page | `honesty.test`, E2E |
| FR-070–075 contact | `ContactForm`, `MapEmbed`, `contactSchema.ts` | `contact-schema.test`, `contact-form.test`, `map-embed.test`, E2E `contact.spec` |
| FR-076 FAQ | `FaqGroup` | component test, E2E keyboard |
| FR-077–079 legal | `LegalPage` | `legal.test`, E2E |

### Test strategy (Constitution IX)
- **Vitest** (`tests/unit`): `data.test` (9 doctors, one per department plus 2nd for General Medicine and Pediatrics, 4 original photos reused, schedules inside Mon–Sat 09:00–21:00, languages from the allowed four, qualification text free of forbidden terms, ≥ 24 tests across 9 categories with ≥ 2 each, price 300–6,000, every department has ≥ 1 doctor and ≥ 3 related tests, 5 packages with resolvable tests, ≥ 6 articles, 250–400 words each, 5 FAQ groups ≥ 3 each, unique ids/slugs, all `isSample`); `filters.test` (department/name/day combos, "Dr." handling, whitespace, special characters, also-known-as search, empty results); `schedule.test` (today/tomorrow/Sunday/midnight Karachi boundary, fixed `now`); `packages.test` (sum equals catalog, price ≤ sum); `readingTime.test`; `contact-schema.test` (required, phone formats with +92/0/spaces/dashes, email, length limits, whitespace-only); `pages.test` (manifest covers every route, unique titles and descriptions, lengths in range, sitemap equals manifest, robots follows `indexable`); `routes.test` (updated: nav, footer and Home links all resolve; no placeholder paths remain); `images.test` (updated: 24 referenced files, sizes, no unreferenced); `honesty.test` (extended to new data and page sources, plus banned-claim words); `guards.test` (no `fetch(`/`XMLHttpRequest`/`localStorage`/`document.cookie` in `src`, no raw `<img>`, no hex in components); RTL tests for `Breadcrumbs`, `FilterBar`/`EmptyState`, `ScheduleTable`, `FaqGroup`, `ContactForm` (errors, focus, success, no `fetch` call), `MapEmbed` (no iframe until pressed, fallback visible).
- **Playwright** (`tests/e2e`, mobile + desktop, plus 320 px overflow): `pages.spec` (every route: status 200, one h1, notice visible, breadcrumb on inner pages, unique `<title>`, canonical), `doctors.spec`, `departments.spec`, `lab-tests.spec`, `health-packages.spec`, `health-tips.spec`, `about-contact-faq-legal.spec`, `links.spec` (updated crawler: follows every internal link from every page; none returns 404 or renders "Coming soon" except the booking page; unknown slug for each detail family returns 404 with the friendly page; `/home-sample-collection` is 404), `seo.spec` (sitemap lists all manifest paths; robots disallows all while not indexable; OG tags present), `offline.spec` (network blocked: filters, search and contact submit work with zero requests), `a11y.spec` (axe WCAG 2.2 AA on every page, plus keyboard operation of filters, accordion, form and the map button), `motion.spec` (reduced motion), `responsive.spec` (no sideways scroll at 320/390/1280).
- **Build gate**: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` with no environment variables, then `npm run test:e2e`.

### Phased delivery (reviewable slices; later phases do not start before earlier acceptance checks pass)
- **Phase A — Foundation**: dependencies, types, `pages.ts`, `seo.ts`, `Breadcrumbs`, `PageHeader`, `EmptyState`, `FilterBar`, `Skeleton`, `loading.tsx`, sitemap/robots/OG default, `/book-appointment` (removed from the placeholder registry), retarget the Home sample-collection link; update affected Feature 001 tests. The catch-all and the rest of the registry stay until each page's phase lands: every phase removes its own paths from the registry, and the last task of Phase D deletes the catch-all and the registry (see risk 1).
- **Phase B — P1 Doctors and Departments** (incl. five doctor photos in data).
- **Phase C — P2 Lab Tests and Health Packages**.
- **Phase D — P3 Health Tips, About, Contact, FAQ, Privacy, Terms** (incl. two tip photos in data).
- **Phase E — Polish and gates**: full axe/keyboard/overflow/offline pass, build with no env, manual Lighthouse on `/doctors`, `/lab-tests`, `/contact`, honesty scan, image check, quickstart verified.

### Risks and mitigations (top 3)
1. **Dead links during the transition.** Deleting the catch-all before every real page exists would 404 existing nav links. *Mitigation*: Phase A keeps the catch-all registry for paths whose real page has not landed (the registry shrinks per phase; the Feature 001 test that fails if a registered path also has a real page stays on); the catch-all is deleted in the last task of Phase D together with `home-sample-collection`. Blast radius: navigation only on the feature branch.
2. **Client islands hurting performance or causing layout shift.** *Mitigation*: server renders the full list; the island hydrates with the same markup; skeleton and fallback share dimensions; check CLS and bundle sizes in Phase E; fall back to server-side filtering by links (`?department=`) if INP regresses.
3. **Honesty drift in new content** (invented credentials, real institutions, claims in articles). *Mitigation*: forbidden-word and pattern scan over all data and page sources, review checklist in `tasks.md`, "Sample"/"Illustrative" labels asserted by E2E on every page.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| None | — | — |

The Feature 001 deferral of Lighthouse CI budgets to Phase 4 still applies; this feature records manual Lighthouse results in `quickstart.md`.
