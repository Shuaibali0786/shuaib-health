---

description: "Task list for Feature 002: all remaining public pages of Shuaib Health (frontend, mock data)"
---

# Tasks: Public Pages

**Input**: Design documents from `/specs/002-public-pages/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md, contracts/routes.md, contracts/content-shapes.md
**Branch**: `002-public-pages`

**Tests**: Required by constitution Principle IX (unit tests for logic, Playwright for key flows). Tests sit inside each story phase, next to the code they cover; Principle IX does not require test-first.

**Organization**: Tasks are grouped by user story (spec priorities). Phase 1 and 2 are shared groundwork (plan "Phase A"); each story phase is a reviewable, independently testable slice (plan "Phases B–D"); the last phase is plan "Phase E".

| Story | Priority | Title | Phase |
|-------|----------|-------|-------|
| US1 | P1 | Find the right doctor | 3 (MVP) |
| US2 | P1 | Explore departments | 4 |
| US3 | P2 | Browse lab tests and prepare correctly | 5 |
| US4 | P2 | Compare health packages | 6 |
| US5 | P3 | Read health tips | 7 |
| US6 | P3 | Understand who the clinic is and how a visit works (About) | 8 |
| US7 | P3 | Reach the clinic and get answers (Contact + FAQ) | 9 |
| US8 | P3 | Read the privacy and terms pages | 10 |
| - | - | Polish, cleanup, gates | 11 |

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency on an unfinished task)
- **[Story]**: US1–US8, only in story phases (Setup, Foundational and Polish have none)
- All paths are relative to the repository root `D:\shuaib-health`; `frontend/` is the app root.

## Conventions for every task

- **Windows CMD** for commands, run from `D:\shuaib-health\frontend` unless stated. Use `cd`, `dir`, `copy`, `del`, `findstr`, `set NAME=value`, `&&`.
- TypeScript strict; **no `any`**. No hex colours in components (tokens only). No raw `<img>`; use `next/image` through `ImageWithFallback`.
- Components read content only through `frontend/src/lib/content.ts`. Pure logic lives in `frontend/src/lib/` and is unit-tested without React.
- No `fetch`, `XMLHttpRequest`, `localStorage`, `sessionStorage`, `document.cookie` or `dangerouslySetInnerHTML` anywhere in `frontend/src` (the opt-in map frame in US7 is the only external request).
- Every record is `isSample: true`. Every list/detail page shows the `SampleBadge` or the "Illustrative image" note where specified. No forbidden words: rated, rating, review, award, accredited, certified, JCI, ISO, "patients served", PMDC, registration number, real hospital/university names.
- Read the matching Next.js doc in `frontend/node_modules/next/dist/docs/` before writing each new file convention (`sitemap`, `robots`, `opengraph-image`, `loading`, `generateStaticParams`), as `frontend/AGENTS.md` requires.
- Every page: unique manifest title and description, breadcrumb (not Home), one `h1` via `PageHeader`, `generateMetadata` using `pageMetadata()`.
- Do not commit unless asked; each checkpoint is a good commit point.
- While the catch-all `[...slug]` exists, a path may not be both a registered placeholder and a real page: each story removes its own paths from the registry in `frontend/src/lib/routes.ts`.

---

## Phase 1: Setup

- [X] T001 Install the three form dependencies: `cd D:\shuaib-health\frontend && npm install react-hook-form@^7.89 zod@^4.6 @hookform/resolvers@^5.9`; confirm with `npm ls react-hook-form zod @hookform/resolvers` and that `frontend/package.json` and `package-lock.json` changed only for these
- [X] T002 [P] Create `frontend/.env.example` with a commented, placeholder-only `SITE_URL=http://localhost:3000` line (optional public base URL for the sitemap and canonical links); confirm root `.gitignore` still ignores `.env` and keeps `!.env.example`
- [X] T003 Record the baseline in a scratch note (not committed): run `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`; all must be green before changes **Done:** baseline was green except the Feature 001 images test, which failed only because the 7 new photos were not referenced yet.
- [X] T004 Extend `frontend/src/types/content.ts` with the shapes from `specs/002-public-pages/contracts/content-shapes.md` needed first: `Language`, `ScheduleSession`, new required fields on `Doctor` (`qualifications`, `experienceYears`, `languages`, `bio`, `schedule`) and `Department` (`overview`, `conditions`, `services`, `relatedTestSlugs`), `LabTestCategory`, `LabTest`, `HealthPackage`, `PageManifestEntry`, `SiteConfig.labHours` and `SiteConfig.mapArea`, and the new `IconName` members. Do NOT add `HealthTip.body`, `Faq*`, `Legal*` yet (US5, US7, US8 add them with their data)
- [X] T005 [P] Extend `frontend/src/components/ui/icons.ts` so `ICONS` maps every new `IconName` (`droplet`→Droplet, `candy`→Candy, `flame`→Flame, `bean`→Bean, `activity`→Activity, `sun`→Sun, `sparkles`→Sparkles, `test-tube`→TestTube, `clipboard-check`→ClipboardCheck, `flower`→Flower2, `hourglass`→Hourglass); update the exhaustive-record check in the existing icon/data test if one exists

**Checkpoint**: dependencies installed, types compile errors only where data is not yet updated (fixed in Phase 2).

---

## Phase 2: Foundational (blocks every user story)

**Purpose**: shared data, logic, UI building blocks, metadata files and route plumbing that all stories use.

### Data and logic

- [X] T006 Add `labHours` (Mon–Sat 08:00–20:00) and `mapArea` (`bbox: [66.95, 24.78, 67.20, 24.96]`, label "General area of Karachi") to `frontend/src/data/siteConfig.ts`
- [X] T007 Extend `frontend/src/data/doctors.ts` to nine doctors in this order: the four existing (add fields; keep `isFeatured: true` only on them, same photos), then Dr. Maryam Baloch (Dermatology, `dept-dermatology`), Dr. Bilal Ansari (Dental), Dr. Zainab Memon (Pathology Lab), Dr. Omar Sheikh (General Medicine, 2nd), Dr. Faisal Chaudhry (Pediatrics, 2nd), each `isFeatured: false`, slug `dr-first-last`, photo `/images/doctors/<slug>.jpg` 600×750 with the alt text from `specs/002-public-pages/quickstart.md` (Images table). Rules from `data-model.md`: generic qualifications (e.g. "MBBS", "FCPS (Dermatology)"), `experienceYears` 3–30, languages only from Urdu/English/Sindhi/Punjabi (vary them; include Sindhi and Punjabi on some), 2–3 sentence bio with no outcome claims, ≥ 2 schedule sessions Mon–Sat inside 09:00–21:00 without overlap (vary days so every weekday Mon–Sat has at least one doctor), fees PKR 1,500–4,000
- [X] T008 [P] Extend `frontend/src/data/departments.ts` with `overview` (2–3 sentences), `conditions` (5–8, general list), `services` (5–8) and `relatedTestSlugs` (≥ 3, real slugs from T009) for all seven departments; no diagnosis or treatment claims
- [X] T009 [P] Create `frontend/src/data/labTests.ts` exporting `labTestCategories` (nine, in order Blood, Diabetes, Heart, Liver, Kidney, Thyroid, Vitamins, Hormones, Urine, with `iconName` per research R14) and `labTests` with 26 tests: Blood (Complete Blood Count, ESR, Blood Group & Rh Factor); Diabetes (Fasting Blood Sugar, HbA1c, Random Blood Sugar); Heart (Lipid Profile, hs-CRP); Liver (Liver Function Tests, Hepatitis B Surface Antigen, Hepatitis C Antibody); Kidney (Serum Creatinine, Blood Urea, Uric Acid); Thyroid (TSH, Free T4, Free T3); Vitamins (Vitamin D, Vitamin B12, Folate); Hormones (Prolactin, Total Testosterone, FSH); Urine (Urine Routine Examination, Urine Culture & Sensitivity, Urine Pregnancy Test). Each: kebab-case slug, 0–4 `alsoKnownAs` (e.g. HbA1c → "Glycated hemoglobin", "A1c"; Fasting Blood Sugar → "FBS", "Fasting glucose"), integer `pricePkr` 300–6,000 (realistic Karachi sample prices), `sampleType`, `reportTime`, `preparation` (logistics only, e.g. "10–12 hours fasting"), `homeCollection` boolean (false for Urine Culture), one-sentence `about` with no interpretation or ranges, `relatedDepartmentIds` (≥ 1), `isSample: true`
- [X] T010 Add accessors to `frontend/src/lib/content.ts`: `getDoctors`, `getDoctorsByDepartment`, `getLabTestCategories`, `getLabTests`, `getLabTestBySlug`, `getLabTestsBySlugs` (keep existing accessors unchanged; `getFeaturedDoctors` must still return the original four)
- [X] T011 [P] Extend `frontend/src/lib/format.ts`: export `formatTime`; add `formatTimeRange(start, end)` ("9 AM – 1 PM") and `formatDayLong(day)` ("Monday"); add cases to `frontend/tests/unit/format.test.ts`
- [X] T012 [P] Create `frontend/src/lib/schedule.ts`: `availableDays(schedule)` (ordered Mon→Sat), `groupScheduleByDay(schedule)`, and `nextAvailable(schedule, now = new Date())` using `Intl.DateTimeFormat` with `timeZone: "Asia/Karachi"` (research R11); result `{ kind: "today" | "tomorrow" | "later"; day; end? }`
- [X] T013 [P] Create `frontend/tests/unit/schedule.test.ts`: fixed-`now` cases for later today, session already ended, tomorrow, Sunday (no session → Monday), 23:59 vs 00:00 Karachi boundary, a doctor with one session, and `availableDays` ordering
- [X] T014 [P] Create `frontend/src/lib/filters.ts`: `normalizeQuery` (trim, collapse spaces, lowercase; strip a leading "dr"/"dr." token only if other text remains), `filterDoctors(doctors, { department, query, day })`, `filterLabTests(tests, { category, query })` (name + `alsoKnownAs`, literal matching, never a RegExp from input), and helpers to read/write the query-string parameters from `contracts/routes.md` rule 9 (unknown values ignored)
- [X] T015 [P] Create `frontend/tests/unit/filters.test.ts`: department/name/day combinations, "Dr." alone returns all, "dr sana" and "SANA " match, special characters (`(`, `*`, `\`) return empty without throwing, also-known-as match ("a1c" finds HbA1c), unknown param values ignored
- [X] T016 [P] Extend `frontend/tests/unit/data.test.ts` for doctors, departments and lab tests using invariants 1–3 and 5 of `data-model.md` (9 doctors; each department ≥ 1 doctor, General Medicine and Pediatrics exactly 2; original four photos unchanged; schedules Mon–Sat inside 09:00–21:00 without overlap; every weekday has a doctor; languages from the allowed four; no forbidden words in qualifications/bios; ≥ 24 tests, nine categories each ≥ 2, prices integers 300–6,000; every `relatedTestSlugs` resolves; unique ids/slugs); update the Feature 001 assertions that assumed 4 doctors **Done:** the new invariants live in `frontend/tests/unit/public-data.test.ts`; `data.test.ts` keeps the Feature 001 checks, updated for 9 doctors.
- [X] T017 Update `frontend/tests/unit/images.test.ts` to expect 24 referenced images (17 + 5 doctors + 2 tips): the 5 doctor photos become referenced by T007; the 2 tip photos stay unreferenced until US5, so keep that single test marked with a comment `// red until T071 (US5) references hand-hygiene and managing-stress` rather than editing the assertion **Done:** instead of leaving a red test, `images.test.ts` has a `PENDING` list for the two tip photos (remove it in T071); the referenced count is 22 until then.

### Metadata, routes and shared UI

- [X] T018 Create `frontend/src/lib/seo.ts`: `pageMetadata(entry: PageManifestEntry): Metadata` (title, description, `alternates.canonical`, `openGraph` and `twitter` card fields, `robots` from `siteConfig.indexable`) and `siteUrl()` (reads optional `process.env.SITE_URL`, default `http://localhost:3000`, strips trailing slash)
- [X] T019 Create `frontend/src/lib/pages.ts`: `getPageManifest()` returning `PageManifestEntry[]` for Home, every static route, and (so far) doctors, departments and lab tests, with hand-written short titles and 50–160-character descriptions (per-record descriptions for doctors, departments, tests); `/book-appointment` has `inSitemap: false`; export `getManifestEntry(path)`
- [X] T020 Update `frontend/src/lib/routes.ts`: add `ROUTES.faq`, `labTestPath(slug)`; remove `/home-sample-collection` and `/book-appointment` from the placeholder registry; register `/lab-tests/<slug>` placeholders (kind `lab-test`) for every test so department links work before US3; extend `isKnownPath` accordingly; update `frontend/tests/unit/routes.test.ts` (counts, kinds, nav/footer/Home links resolve, no registered path has a real page)
- [X] T021 Create `frontend/src/app/book-appointment/page.tsx` rendering `ComingSoon` with title "Booking coming soon" (h1 text "Booking coming soon"; update `frontend/src/components/coming-soon/ComingSoon.tsx` to take optional `heading` and keep "Coming soon" as the default), metadata from the manifest, link back to Home; update `frontend/tests/unit/coming-soon.test.tsx`
- [X] T022 Change the home-sample-collection quick action `href` in `frontend/src/data/homeContent.ts` to `/faq#home-sample-collection`; update the Home/links tests that assert the old path (`frontend/tests/unit/home-sections.test.tsx`, `frontend/tests/unit/routes.test.ts`, `frontend/tests/e2e/home.spec.ts` if it checks it). The FAQ target is built in US7; until then the link resolves to the registered FAQ placeholder
- [X] T023 Update `frontend/src/app/layout.tsx`: add `metadataBase: new URL(siteUrl())`; keep everything else unchanged
- [X] T024 [P] Create `frontend/src/app/loading.tsx` (shared skeleton for route transitions using `Skeleton`, inside `Container`, no animation under reduced motion) **Not created, on purpose:** a root `loading.tsx` wraps every page in a streaming boundary, so with JavaScript off visitors only saw the skeleton (found in testing; it also hit Home). Loading states come from the Suspense fallbacks of the filter islands.
- [X] T025 [P] Create `frontend/src/app/sitemap.ts` (maps `getPageManifest()` where `inSitemap`, absolute URLs via `siteUrl()`) and `frontend/src/app/robots.ts` (`disallow: "/"` while `siteConfig.indexable` is false, otherwise allow + sitemap link)
- [X] T026 [P] Create `frontend/src/app/opengraph-image.tsx`: 1200×630 brand card (logo mark paths from `logo-paths.ts`, name, tagline, notice text) with `ImageResponse`, following `apple-icon.tsx`; if rendering the mark fails, use text only (research R6)
- [X] T027 [P] Create `frontend/src/components/layout/Breadcrumbs.tsx` (`<nav aria-label="Breadcrumb"><ol>`, last item plain text with `aria-current="page"`, CSS separators, wraps at 320 px) and `frontend/tests/unit/breadcrumbs.test.tsx`
- [X] T028 [P] Create `frontend/src/components/layout/PageHeader.tsx` (Breadcrumbs + one `h1` + intro + optional `SampleBadge`/note slot, uses existing gradient and `Container`)
- [X] T029 [P] Create `frontend/src/components/ui/EmptyState.tsx` (message, optional description, "Clear filters" `Button` calling `onClear`) and `frontend/src/components/ui/Skeleton.tsx` (token-based block; `motion-safe` pulse only) **Done:** `EmptyState` only; `Skeleton` was dropped together with `loading.tsx`.
- [X] T030 [P] Create `frontend/src/components/ui/FilterBar.tsx`: wrapper for labelled controls (`SearchField`, `SelectField`, `ChipGroup` exports; every control has a visible `<label>`, chips are `aria-pressed` buttons, 24 px minimum targets) plus a `ResultCount` (`role="status"`, `aria-live="polite"`); `frontend/tests/unit/filter-bar.test.tsx` covers labels, `aria-pressed`, live count text and `EmptyState` clear action
- [X] T031 [P] Create `frontend/src/components/ui/IllustrativeNote.tsx` (small caption with two variants: `person` = "Stock photo of a model. Sample profile — name and details are fictional." and `facility` = "Illustrative image, not our actual facility.")
- [X] T032 [P] Create `frontend/src/components/lab-tests/LabTestCard.tsx` (name, also-known-as, category icon, `formatPkr` price with "Sample price" label, sample type, report time, preparation, home collection yes/no, link to `labTestPath`; `compact` prop for department pages) — links work via the T020 placeholders until US3
- [X] T033 Extend the honesty text scan in `frontend/tests/unit/honesty.test.ts` to cover the new data files (`doctors`, `departments`, `labTests`) and a shared forbidden-word list exported from `frontend/tests/unit/helpers/forbidden.ts` (reused by later stories)

**Checkpoint**: `npm run lint && npm run typecheck && npm test && npm run build` pass (except the one marked-red images test). Home still works; `/book-appointment` says "Booking coming soon"; `/sitemap.xml` and `/robots.txt` respond; Home sample-collection link resolves.

---

## Phase 3: User Story 1 — Find the right doctor (P1) 🎯 MVP

**Goal**: `/doctors` (filters) and `/doctors/[slug]` (profile) with a working "Book appointment" path.
**Independent Test**: with nothing else built, open `/doctors`, use department, name and day filters and the empty state, open a profile, press "Book appointment" and land on "Booking coming soon"; `/doctors/nobody` is not-found.

- [X] T034 [P] [US1] Extend `frontend/src/components/home/DoctorCard.tsx` with `variant="detailed"`: adds short qualifications, languages, fee, `NextAvailable` and a "Sample profile" label (home variant unchanged; keep the stretched-link pattern)
- [X] T035 [P] [US1] Create `frontend/src/components/doctors/NextAvailable.tsx` (client): server/first render shows "Available Mon, Wed, Fri" from `availableDays`; after mount (effect) replaces it with "Next: Today until 9 PM / Tomorrow / Wed" from `nextAvailable`, with `time zone: Asia/Karachi` stated in a `title`/sr-only text
- [X] T036 [P] [US1] Create `frontend/src/components/doctors/ScheduleTable.tsx`: `<table>` with `<caption>` "Weekly schedule (Asia/Karachi)", `<th scope="col">` Day/Time, `<th scope="row">` per day, multiple sessions joined with " · ", no horizontal page scroll at 320 px
- [X] T037 [US1] Create `frontend/src/components/doctors/DoctorBrowser.tsx` (client, `useSearchParams` + `router.replace(..., { scroll: false })`): department select, name search, day select (Mon–Sat), `ResultCount`, grid of detailed `DoctorCard`s, `EmptyState` "No doctors match your filters" with "Clear filters"
- [X] T038 [US1] Create `frontend/src/app/doctors/page.tsx`: `PageHeader` (Breadcrumbs Home › Doctors), `<Suspense fallback={full server-rendered list}>` around `DoctorBrowser`, `generateMetadata` from the manifest
- [X] T039 [US1] Create `frontend/src/app/doctors/[slug]/page.tsx` with `generateStaticParams`, `dynamicParams = false`, `notFound()` guard, breadcrumb Home › Doctors › name, photo, specialty, qualifications, "Experience: N years (sample)", languages, fee, `ScheduleTable`, bio, department link, "Book appointment" `Button` to `/book-appointment`, `SampleBadge` + "Sample profile" note, `generateMetadata` per doctor; verify unknown slug gives status 404 with layout (plan risk R2; if not, switch to default `dynamicParams` + `notFound()` and record it in `research.md` R2)
- [X] T040 [P] [US1] Create `frontend/src/app/doctors/[slug]/opengraph-image.tsx` (brand card with doctor name and specialty, `generateStaticParams` from data)
- [X] T041 [US1] Remove `/doctors` and all `/doctors/<slug>` entries from the placeholder registry in `frontend/src/lib/routes.ts` (the registry's doctor kind goes away) and adjust `routes.test.ts`
- [X] T042 [P] [US1] Component tests: `frontend/tests/unit/schedule-table.test.tsx` (caption, row headers, grouped sessions) and `frontend/tests/unit/doctor-browser.test.tsx` (nine cards initially, department filter, name search, combined filters, empty state and clear, count announced; mock `next/navigation`)
- [X] T043 [US1] Playwright `frontend/tests/e2e/doctors.spec.ts`: nine cards with "Sample profile"; filters and URL query survive back navigation; empty state; profile fields, schedule table, department link; "Book appointment" → "Booking coming soon"; unknown slug 404 with friendly page and notice; `page.clock.setFixedTime` check of the "Next:" text; network-blocked run makes no non-same-origin request
- [X] T044 [US1] Add US1 pages to `frontend/tests/e2e/a11y.spec.ts` (axe WCAG 2.2 AA on `/doctors` filtered/empty and a profile, mobile and desktop) and keyboard test (filters operable, focus visible, Tab order) **Done:** the keyboard test is in `doctors.spec.ts`; axe covers the list (default, filtered, empty), two profiles and `/book-appointment` in `a11y.spec.ts`.

**Checkpoint (MVP)**: US1 passes its Independent Test; run quickstart P1 steps 1, 2, 4.

---

## Phase 4: User Story 2 — Explore departments (P1)

**Goal**: `/departments` and `/departments/[slug]` with doctors and related tests.
**Independent Test**: open all seven departments; each has overview, conditions, services, ≥ 1 doctor linking to a profile, ≥ 3 related tests with working links, and a booking button.

- [X] T045 [P] [US2] Create `frontend/src/components/departments/DepartmentSections.tsx` (overview, "Common conditions (general list)", services list, doctors grid reusing `DoctorCard`, related tests reusing compact `LabTestCard`, booking `Button`)
- [X] T046 [US2] Create `frontend/src/app/departments/page.tsx` (breadcrumb Home › Departments, seven cards reusing `DepartmentCard`, manifest metadata)
- [X] T047 [US2] Create `frontend/src/app/departments/[slug]/page.tsx` (`generateStaticParams`, `dynamicParams = false`, breadcrumb Home › Departments › name, hero image via `ImageWithFallback`, sections from T045, per-department metadata) and `frontend/src/app/departments/[slug]/opengraph-image.tsx`
- [X] T048 [US2] Remove `/departments` and `/departments/<slug>` from the placeholder registry; update `routes.test.ts`
- [X] T049 [P] [US2] Playwright `frontend/tests/e2e/departments.spec.ts`: seven cards in order; each department page shows required sections, General Medicine and Pediatrics list two doctors, doctor and test links return 200 with breadcrumb, booking button goes to "Booking coming soon", unknown slug 404; add the pages to `a11y.spec.ts`

**Checkpoint**: US1 and US2 both pass; run quickstart P1 step 3.

---

## Phase 5: User Story 3 — Browse lab tests and prepare correctly (P2)

**Goal**: `/lab-tests` catalog with search and category filter, plus `/lab-tests/[slug]` pages.
**Independent Test**: search "sugar", "HbA1c", "cbc"; filter every category; open a test page; all required fields and the "Sample price" label are present.

- [X] T050 [P] [US3] Create `frontend/src/components/lab-tests/LabTestBrowser.tsx` (client): search field, category `ChipGroup` with counts and icons, `ResultCount`, grid of `LabTestCard`, `EmptyState` "No lab tests match your search" with clear
- [X] T051 [US3] Create `frontend/src/app/lab-tests/page.tsx` (breadcrumb Home › Lab Tests, Suspense fallback with the full list, "All prices are sample prices" note, manifest metadata)
- [X] T052 [P] [US3] Create `frontend/src/components/lab-tests/LabTestFacts.tsx` (definition list: category, sample type, report time, preparation, home collection yes/no, price with "Sample price" badge; adds "Follow your doctor's instructions about preparation" and a no-interpretation note)
- [X] T053 [US3] Create `frontend/src/app/lab-tests/[slug]/page.tsx` (`generateStaticParams`, `dynamicParams = false`, breadcrumb Home › Lab Tests › name, facts, `about`, related departments as links, "Included in packages" block rendered only when packages exist — wired in T058) and `frontend/src/app/lab-tests/[slug]/opengraph-image.tsx` **Done:** the "Included in packages" block was added with T058.
- [X] T054 [US3] Remove `/lab-tests` and all `/lab-tests/<slug>` entries from the placeholder registry; update `routes.test.ts`
- [X] T055 [P] [US3] Component test `frontend/tests/unit/lab-test-browser.test.tsx` (search by name and also-known-as, category chip `aria-pressed`, combined filters, empty state) and add lab-test data guards to `data.test.ts` (`about` has no digits-with-units reference ranges, preparation non-empty) **Done:** the lab-test data guards already live in `public-data.test.ts` (invariant 5), so `data.test.ts` was not touched.
- [X] T056 [US3] Playwright `frontend/tests/e2e/lab-tests.spec.ts`: catalog fields and price format, searches ("sugar", "hba1c", "cbc"), each category, empty state, test page fields and breadcrumb, unknown slug 404, no non-same-origin requests; add pages to `a11y.spec.ts`

**Checkpoint**: US3 passes; run quickstart P2 step 1.

---

## Phase 6: User Story 4 — Compare health packages (P2)

**Goal**: `/health-packages` with five packages whose totals are derived from the catalog.
**Independent Test**: for every package, included tests link to catalog pages, the sum matches the catalog and the package price is not higher.

- [X] T057 [US4] Create `frontend/src/data/healthPackages.ts` with five packages and `testSlugs` from the catalog: Basic Health Check (CBC, Fasting Blood Sugar, Lipid Profile, Liver Function Tests, Serum Creatinine, Urine Routine Examination); Diabetes Care (Fasting Blood Sugar, HbA1c, Random Blood Sugar, Lipid Profile, Serum Creatinine, Urine Routine Examination); Heart Check (Lipid Profile, hs-CRP, Fasting Blood Sugar, Serum Creatinine, Uric Acid, CBC); Women's Health (CBC, TSH, Vitamin D, Vitamin B12, Prolactin, Urine Routine Examination); Senior Citizen (CBC, Fasting Blood Sugar, HbA1c, Lipid Profile, Liver Function Tests, Serum Creatinine, Uric Acid, TSH, Vitamin D, Urine Routine Examination). Each: `whoFor`, sample `packagePricePkr` below the sum, preparation consistent with included tests, `homeCollection` true only if all included tests allow it, icon names per research R14
- [X] T058 [P] [US4] Create `frontend/src/lib/packages.ts` (`summarizePackage(pkg, tests)` → `{ tests, sumPkr, savingPkr }`, throws if a slug is unknown) and add accessors `getHealthPackages`, `getPackagesIncludingTest` to `frontend/src/lib/content.ts`; render the "Included in packages" block on the test page (T053) from it
- [X] T059 [P] [US4] Create `frontend/tests/unit/packages.test.ts`: for all five packages the displayed sum equals the catalog sum, `packagePricePkr ≤ sumPkr`, `savingPkr` correct, all `testSlugs` resolve with no duplicates, `homeCollection` rule, unknown slug throws
- [X] T060 [US4] Create `frontend/src/components/packages/PackageCard.tsx` (icon tile, name, who it is for, included tests as links to `labTestPath`, three price rows "Sum of individual tests", "Package price", "Difference" (PKR amount only, no percent or promotional words), preparation, home collection yes/no, "Sample price" label)
- [X] T061 [US4] Create `frontend/src/app/health-packages/page.tsx` (breadcrumb Home › Health Packages, five cards, sample note, manifest metadata); remove `/health-packages` from the placeholder registry; update `routes.test.ts`
- [X] T062 [US4] Playwright `frontend/tests/e2e/health-packages.spec.ts`: five packages, every test link returns 200, displayed numbers recomputed from the linked test pages' prices equal the shown sum, difference row present, test pages list their packages; add the page to `a11y.spec.ts`

**Checkpoint**: US4 passes; run quickstart P2 step 2.

---

## Phase 7: User Story 5 — Read health tips (P3)

**Goal**: `/health-tips` (category filter) and `/health-tips/[slug]` with ≥ 6 articles.
**Independent Test**: filter each category, open every article; each has text, the "General information, not medical advice" note, reading time and related articles.

- [X] T063 [US5] Add `ArticleBlock` and `HealthTip.body` to `frontend/src/types/content.ts` (per `contracts/content-shapes.md`)
- [X] T064 [US5] Write `body` blocks (heading, paragraph, list) of 250–400 words for the four existing articles in `frontend/src/data/healthTips.ts`: general lifestyle information only, no dosage/diagnosis/treatment claims, no forbidden words
- [X] T065 [US5] Add two articles to `frontend/src/data/healthTips.ts`: `hand-hygiene` (category "Hygiene", image `/images/tips/hand-hygiene.jpg` 800×500, alt from quickstart Images table) and `managing-stress` (category "Mental wellbeing", image `/images/tips/managing-stress.jpg`), `publishedAt` dates earlier than 2026-08-14 so Home's latest three are unchanged, each 250–400 words
- [X] T066 [P] [US5] Create `frontend/src/lib/readingTime.ts` (`readingMinutes(blocks)` = `max(1, ceil(words / 200))`) and `frontend/tests/unit/reading-time.test.ts`; add `getHealthTips`, `getRelatedTips(slug, limit = 3)` (same category first, then newest, never itself) to `frontend/src/lib/content.ts` and a `filterTips` helper to `frontend/src/lib/filters.ts` with tests in `filters.test.ts`
- [X] T067 [P] [US5] Extend `frontend/src/components/home/TipCard.tsx` with optional `showMeta` (category and "N min read"; Home usage unchanged) and create `frontend/src/components/tips/TipBrowser.tsx` (client; category `ChipGroup`, `ResultCount`, `EmptyState`) and `frontend/src/components/tips/ArticleBody.tsx` (renders blocks as `h2`/`p`/`ul`; no raw HTML) and `frontend/src/components/tips/MedicalNote.tsx` ("General information, not medical advice")
- [X] T068 [US5] Create `frontend/src/app/health-tips/page.tsx` (breadcrumb Home › Health Tips, Suspense fallback with the full list, manifest metadata)
- [X] T069 [US5] Create `frontend/src/app/health-tips/[slug]/page.tsx` (`generateStaticParams`, `dynamicParams = false`, breadcrumb Home › Health Tips › title, image, category, date via `formatKarachiDate`, reading time, `ArticleBody`, `MedicalNote`, related articles, `SampleBadge`) and `frontend/src/app/health-tips/[slug]/opengraph-image.tsx`
- [X] T070 [US5] Extend `frontend/src/lib/pages.ts` and `frontend/src/lib/routes.ts`: manifest entries for tips; remove `/health-tips` and `/health-tips/<slug>` from the placeholder registry; update `routes.test.ts`
- [X] T071 [US5] Update `frontend/tests/unit/images.test.ts` and `data.test.ts`: remove the "red until" comment from T017 (the 24 images are now all referenced), add invariant 6 (≥ 6 articles, 250–400 words, every category used, forbidden-word scan via `helpers/forbidden.ts`), and confirm Home still shows the same three newest tips
- [X] T072 [US5] Playwright `frontend/tests/e2e/health-tips.spec.ts`: ≥ 6 cards with category, reading time and "Sample"; each category filter; every article shows the medical note, 2–3 related articles and breadcrumb; unknown slug 404; add pages to `a11y.spec.ts`

**Checkpoint**: US5 passes; run quickstart P3 step 1; `npm test` fully green including images.

---

## Phase 8: User Story 6 — About (P3)

**Goal**: honest About page.
**Independent Test**: read `/about`; mission, values, labelled illustrative photos and a five-step visit flow exist and no banned claims appear.

- [X] T073 [US6] Create `frontend/src/data/aboutContent.ts` (`AboutContent`: honest story paragraphs stating it is a portfolio demo and not a real clinic, mission, 3–5 values, five `visitSteps` — find a doctor or test, book (coming soon), visit or home collection, receive reports online (planned), follow up; `facilityPhotos` reusing `/images/clinic/clinic-interior.jpg` and department images `general-medicine`, `pathology-lab`, `dental` with captions "Illustrative image …"); no founding date, counts, awards, accreditations, testimonials; add `getAboutContent` to `content.ts`
- [X] T074 [P] [US6] Create `frontend/src/components/about/VisitSteps.tsx` (`<ol>` with numbered `IconTile`s) 
- [X] T075 [US6] Create `frontend/src/app/about/page.tsx` (breadcrumb, story, mission, values, photo grid with `IllustrativeNote`, `VisitSteps`, link to doctors and lab tests, manifest metadata); remove `/about` from the placeholder registry; update `routes.test.ts`
- [X] T076 [P] [US6] Extend `honesty.test.ts` to scan `aboutContent.ts` and the About page source (also for digits followed by "years", "patients", "+" claims); Playwright `frontend/tests/e2e/about.spec.ts` (sections, numbered steps, every photo has an "Illustrative" caption, banned-words scan of rendered text); add to `a11y.spec.ts`

**Checkpoint**: US6 passes.

---

## Phase 9: User Story 7 — Contact and FAQ (P3)

**Goal**: `/contact` (details, hours, opt-in map, validated non-sending form) and `/faq` (five grouped accordions).
**Independent Test**: submit the form empty, invalid, valid (message says it is not sent; zero requests); press "Show map"; expand FAQ items by keyboard; open `/faq#home-sample-collection` from Home.

- [ ] T077 [US7] Add `FaqItem`, `FaqGroup` types and create `frontend/src/data/faq.ts` with five groups (slugs `appointments`, `lab-tests-reports`, `payments`, `home-sample-collection`, `privacy`; titles per spec; ≥ 3 items each, ~20 total) whose answers never claim a live service (booking, online payment and report portal are described as planned; home collection described as sample); add `getFaqGroups` to `content.ts`
- [ ] T078 [P] [US7] Create `frontend/src/components/faq/FaqGroup.tsx` (`<section id={slug} aria-labelledby>` with `h2` and `<details><summary>` items, chevron rotation `motion-safe` only) and `frontend/tests/unit/faq-group.test.tsx` (heading, anchor id, toggling `open` by keyboard Enter/Space)
- [ ] T079 [US7] Create `frontend/src/app/faq/page.tsx` (breadcrumb, group links at top, five groups, manifest metadata); remove `/faq` from the placeholder registry (it backs the Home sample-collection link from T022)
- [ ] T080 [US7] Create `frontend/src/lib/contactSchema.ts` (Zod: name 2–80, `contact` valid phone or email, subject 3–100, message 10–1,000, all trimmed; phone normaliser accepts `+92 300 0000000`, `0300-0000000`, `021 3000 0000`) with `frontend/tests/unit/contact-schema.test.ts` (required, whitespace-only, long input, phone shapes, invalid email, both phone and email)
- [ ] T081 [US7] Create `frontend/src/components/contact/ContactForm.tsx` (client; React Hook Form + `zodResolver`, `noValidate`, labels, `aria-invalid`/`aria-describedby`, error summary with links that takes focus on failed submit, first invalid field focus, values kept; success `role="status"` "Messages are not sent in this demo yet. Nothing was saved or transmitted."; no `fetch`, no storage) and `frontend/tests/unit/contact-form.test.tsx` (errors, focus, success, `fetch` spy never called)
- [ ] T082 [P] [US7] Create `frontend/src/components/contact/MapEmbed.tsx` (client): text address + note "Map shows the general area; the address is a sample" + disclosure "Showing the map contacts OpenStreetMap"; "Show map" button then renders the iframe from research R7 (`title`, `loading="lazy"`, `referrerPolicy="no-referrer"`, `sandbox="allow-scripts allow-same-origin"`, bbox from `siteConfig.mapArea`), plus an "Open this area in OpenStreetMap" text link; `frontend/tests/unit/map-embed.test.tsx` (no iframe until pressed, fallback always visible, iframe attributes)
- [ ] T083 [US7] Create `frontend/src/app/contact/page.tsx`: breadcrumb; details card (sample address, general and emergency `tel:` links from `siteConfig`, note that demo numbers do not connect and real emergencies go to local emergency services); hours table with clinic and lab rows via `formatOpeningHours` (caption, `th scope`); `MapEmbed`; `ContactForm`; manifest metadata; remove `/contact` from the placeholder registry; update `routes.test.ts`
- [ ] T084 [US7] Playwright `frontend/tests/e2e/contact-faq.spec.ts`: contact details and hours labelled sample; empty submit shows summary and focus moves to it; invalid then valid submit shows the demo message; with all non-same-origin routes aborted and requests counted there are zero requests on submit; "Show map" is the only action that creates an `openstreetmap.org` frame request; FAQ expand/collapse by keyboard on each group, `/faq#home-sample-collection` scrolls to the group and Home's quick action leads there; add `/contact` and `/faq` to `a11y.spec.ts`

**Checkpoint**: US7 passes; run quickstart P3 steps 2 and 3.

---

## Phase 10: User Story 8 — Privacy and Terms (P3)

**Goal**: readable demo legal pages.
**Independent Test**: each page shows its last-updated date, demo and not-legal-advice notices, and a heading for every required topic.

- [ ] T085 [US8] Add `LegalSection`, `LegalContent` types and create `frontend/src/data/legalContent.ts`: Privacy (sections: data a real app would collect; how health data would be protected; roles — patient, receptionist, doctor, lab staff, admin — and what each can see, with "a patient sees only their own data"; how lab reports would be accessed — only the owner and authorised staff, never public links; cookies and this demo, stating no personal data is collected and no tracking cookies are set), Terms (purpose of the demo; sample content; no medical advice; using the site; bookings and payments not live; limits of responsibility); `lastUpdated: "2026-10-02"`; plain language; add `getLegalContent` to `content.ts`
- [ ] T086 [P] [US8] Create `frontend/src/components/legal/LegalPage.tsx` (breadcrumb, `h1`, last-updated via `formatKarachiDate`, notice "Portfolio demo, not legal advice", table of contents with anchor links, `h2` per section, `ArticleBody` blocks)
- [ ] T087 [US8] Create `frontend/src/app/privacy/page.tsx` and `frontend/src/app/terms/page.tsx` (manifest metadata); remove `/privacy` and `/terms` from the placeholder registry; update `routes.test.ts`
- [ ] T088 [P] [US8] Create `frontend/tests/unit/legal.test.ts` (required headings exist, last-updated present, five roles named, demo and not-legal-advice text present, forbidden-word scan) and Playwright `frontend/tests/e2e/legal.spec.ts` (both pages, anchors work, notice visible); add pages to `a11y.spec.ts`

**Checkpoint**: all eight stories pass; every Feature 001 "Coming soon" target is real except booking.

---

## Phase 11: Polish and cross-cutting

- [ ] T089 Delete `frontend/src/app/[...slug]/page.tsx`, the placeholder registry and its helpers in `frontend/src/lib/routes.ts`; rebuild `isKnownPath` and a `knownPaths()` helper from `getPageManifest()` (all pages now in the manifest); rewrite `frontend/tests/unit/routes.test.ts` so nav, footer, Home content and slug builders all resolve to manifest paths and no `[...slug]` exists; keep `ComingSoon` only for `/book-appointment`
- [ ] T090 Finalise `frontend/src/lib/pages.ts`: manifest covers Home, every static route, 9 doctors, 7 departments, all lab tests, all tips; write `frontend/tests/unit/pages.test.ts` (unique titles and descriptions, 50–160 characters, every route family present, `/book-appointment` not in sitemap, sitemap entries equal manifest, `robots()` follows `siteConfig.indexable`)
- [ ] T091 Rewrite `frontend/tests/e2e/links.spec.ts`: crawl every internal link from Home and from each new page (status 200, one non-empty h1, not "Page not found", none renders "Coming soon" except `/book-appointment`); unknown slugs for doctors, departments, lab-tests and health-tips return 404 with the friendly page and notice; `/home-sample-collection` returns 404; update `home.spec.ts` assertions that referenced placeholders
- [ ] T092 [P] Create `frontend/tests/e2e/pages.spec.ts`: for every manifest route on mobile and desktop — status 200, exactly one h1, the notice text, breadcrumb present except Home, unique `<title>`, canonical link, Open Graph tags, sample/illustrative label present where the spec requires it
- [ ] T093 [P] Create `frontend/tests/unit/guards.test.ts`: scan `frontend/src` for `fetch(`, `XMLHttpRequest`, `localStorage`, `sessionStorage`, `document.cookie`, `dangerouslySetInnerHTML`, raw `<img`, hex colour literals in components and backend env names; the only permitted external URL string is the OpenStreetMap embed in `MapEmbed.tsx` and the GitHub credit
- [ ] T094 [P] Create `frontend/tests/e2e/seo.spec.ts`: `/sitemap.xml` lists every manifest path except booking; `/robots.txt` disallows all while not indexable; `<meta name="robots" content="noindex">` still present; generated Open Graph image URLs return 200 `image/png`
- [ ] T095 [P] Create `frontend/tests/e2e/offline.spec.ts`: with the network blocked except same-origin, filters, search, FAQ and contact submit work with zero external requests; the map button degrades to the text address when the frame is blocked
- [ ] T096 [P] Extend `frontend/tests/e2e/motion.spec.ts` (reduced motion: no transforms/animations on new components, accordion and chips still work) and `frontend/tests/e2e/responsive.spec.ts` (no horizontal overflow at 320, 390, 1280 on every manifest route; schedule and hours tables fit)
- [ ] T097 Extend the honesty E2E (`frontend/tests/e2e/honesty.spec.ts`) to visit every manifest route: notice and credit present, no forbidden words in rendered text, every sample doctor/price/article/package/contact block carries its Sample/Illustrative label
- [ ] T098 Run the full gate from `D:\shuaib-health\frontend` with no environment variables set: `npm run lint && npm run typecheck && npm test && npm run build && npm run test:e2e && npm run images -- check`; fix findings; confirm `next build` output lists every detail path as prerendered and that `/contact` is the only route with the form libraries
- [ ] T099 Manual Lighthouse (mobile, production build) on `/doctors`, `/lab-tests`, `/contact`; fill the table in `specs/002-public-pages/quickstart.md`; fix any LCP > 2.5 s or CLS > 0.1 (research R1 fallback to link-based filters if INP regresses)
- [ ] T100 Walk through the quickstart manual checklist at 320 and 390 px, keyboard only, and with reduced motion; confirm the Bilal/Zainab/Faisal photo notes in `research.md` R18 with the user
- [ ] T101 [P] Update `specs/002-public-pages/checklists/requirements.md` notes, add a short "What changed" section to `frontend/README.md` (new routes, `SITE_URL`, new deps), and update the image manifest `specs/001-brand-home-page/image-manifest.md` pointer to the Feature 002 additions (24 files)
- [ ] T102 Create the PHR for the implementation work in `history/prompts/002-public-pages/` (stage `green`, verbatim prompt, concise response) and surface the ADR suggestion if relevant: "📋 Architectural decision detected: static filter islands driven by URL query with server-rendered fallback, and manifest-driven metadata/sitemap — Document reasoning and tradeoffs? Run `/sp.adr static-filter-islands-and-page-manifest`" (never auto-create)

---

## Dependencies and execution order

- **Phase 1 → Phase 2** strictly; Phase 2 blocks all stories.
- **US1 (Phase 3)** needs only Phase 2. **US2 (Phase 4)** needs Phase 2 (uses the `DoctorCard` detailed variant from T034, so do US1 first). **US3 (Phase 5)** needs Phase 2. **US4 (Phase 6)** needs US3's pages (links) and T009 data. **US5–US8** need only Phase 2 and are independent of each other.
- Within a story: data → logic → components → pages → registry removal → tests.
- **Phase 11** starts after the stories you intend to ship are done; T089 requires US1–US8 complete (all paths real).
- Recommended order: Phases 1–2 → US1 (MVP checkpoint) → US2 → US3 → US4 → US5 → US6 → US7 → US8 → Phase 11.

## Parallel opportunities

- Phase 1: T002 and T005 parallel after T001.
- Phase 2: after T004, T008, T009, T011, T012, T013, T014, T015, T016 are all different files; T024–T032 (UI and metadata files) are mutually parallel; T018–T020 are sequential.
- US1: T034, T035, T036, T040 in parallel, then T037 → T038/T039; tests T042 in parallel with page work.
- After Phase 2, **US5, US6, US7 and US8 can proceed in parallel** (different files; each only edits its own registry entries and `pages.ts`/`routes.ts` lines, so merge those two files one story at a time).
- Phase 11: T092–T097 in parallel.

Example (US1): `T034 DoctorCard detailed` ∥ `T035 NextAvailable` ∥ `T036 ScheduleTable` ∥ `T040 OG image`.

## Implementation strategy

- **MVP**: Phase 1 + Phase 2 + US1 (Doctors, with booking holding page). Stop, review, commit.
- **Incremental delivery**: add one story per review (US2 → … → US8). After each, run `npm run lint && npm run typecheck && npm test && npm run build`; Playwright for that story's spec.
- **Safety rule**: at every commit all links resolve (real page or still-registered placeholder); the images test is the only allowed red test and only between T017 and T071.
- **Honesty rule**: any new text is reviewed against the forbidden-word list before commit.
- **Open items to confirm with the user**: the three photo notes in `research.md` R18 (Bilal book cover, Zainab lab action shot, Faisal tape measure), and whether to proceed with `/sp.implement` for Phases 1–3 first.

## Task summary

- Total tasks: 102 (T001–T102)
- Per phase: Setup 5 · Foundational 28 (T006–T033) · US1 11 (T034–T044) · US2 5 (T045–T049) · US3 7 (T050–T056) · US4 6 (T057–T062) · US5 10 (T063–T072) · US6 4 (T073–T076) · US7 8 (T077–T084) · US8 4 (T085–T088) · Polish 14 (T089–T102)
