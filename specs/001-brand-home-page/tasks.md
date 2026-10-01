---

description: "Task list for Feature 001: Shuaib Health brand, site layout and Home page"
---

# Tasks: Shuaib Health Brand, Site Layout and Home Page

**Input**: Design documents from `/specs/001-brand-home-page/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, design-system.md, image-manifest.md, quickstart.md, contracts/routes.md, contracts/content-shapes.md
**Branch**: `001-brand-home-page`

**Tests**: Required by constitution Principle IX (unit tests for logic, Playwright for key flows). Per your requested order, all test tasks are grouped in Phase 7 after the build phases, and each phase still ends with a checkpoint where you run the site. Constitution IX does not require test-first, so this ordering is allowed.

**Organization**: Phases follow your requested order. Each build phase is tagged with its user story so the work stays traceable to the spec:

| Story | Priority | Title | Delivered in |
|-------|----------|-------|--------------|
| US1 | P1 | First impression and clear next step (shell + Hero) | Phase 3 (MVP) |
| US4 | P2 | Find a doctor, department, lab tests or emergency help from Home | Phase 4 |
| US2 | P1 | Navigate the whole site from anywhere (Coming soon, not-found, link integrity) | Phase 2 (pages T063–T065) and Phase 5 (link verification) |
| US3 | P1 | Understand honesty of the demo; US5 P2 comfortable accessible experience | Phase 6 (review and hardening) |
| All | - | Unit tests, Playwright tests | Phase 7 |

The site shell built in Phase 3 (notice bar, header, mobile menu, footer with credit) also delivers most of the US2 and US3 requirements (FR-004 to FR-010); those are verified by tests in Phase 7.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an unfinished task)
- **[Story]**: US1 to US5 (build and test phases only; Setup, Foundational and Final phases have no label)
- All file paths are relative to the repository root `D:\shuaib-health`. `frontend\` is the app root.

## Conventions for every task

- **Windows CMD only**. Run commands from `D:\shuaib-health\frontend` unless the task says otherwise. Use `cd`, `dir`, `copy`, `del`, `rmdir /s /q`, `set NAME=value`, `findstr`, and `&&`. Never use `ls`, `rm`, `cat`, `export`, or `grep`.
- TypeScript strict; **no `any`**. No hex color values in components (tokens only, see design-system.md §1).
- Components use `@/` imports and read content only through `frontend\src\lib\content.ts` (plan: Content layer).
- No network calls, no `fetch`, no environment variables in this feature.
- Do not install Zustand, React Hook Form or Zod.
- Do not commit unless you ask; each checkpoint is a good commit point.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: A working, linted, type-checked Next.js app in `frontend\` with the pinned toolchain from research.md R1.

- [X] T001 Verify the toolchain from `D:\shuaib-health`: run `node -v` (must print `v24.x`) and `npm -v` (must print 10 or newer). If Node is not 24, stop and install Node 24 LTS before continuing.
- [X] T002 Run `npx create-next-app@16.3.7 --help` from `D:\shuaib-health` and confirm the flags `--ts`, `--tailwind`, `--eslint`, `--app`, `--src-dir`, `--import-alias`, `--use-npm` still exist; if a flag was renamed, use its current name in T003.
- [X] T003 Scaffold the app: from `D:\shuaib-health` run `npx create-next-app@16.3.7 frontend --ts --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm`, creating `frontend\package.json` and `frontend\src\app\`.
- [X] T004 In `frontend\`, pin the toolchain: run `npm install -D typescript@~6.0.3 eslint@^9.39.5`, then `npm ls typescript eslint` and confirm TypeScript 6.0.x and ESLint 9.39.x. Add `"engines": { "node": "24.x" }` to `frontend\package.json`.
- [X] T005 Set the npm scripts in `frontend\package.json` exactly as: `dev` = `next dev`, `build` = `next build`, `start` = `next start`, `lint` = `eslint .`, `typecheck` = `tsc --noEmit`, `test` = `vitest run`, `test:e2e` = `playwright test`, `images:placeholders` = `node scripts/generate-placeholder-images.mjs`. No shell-specific syntax (no `NODE_ENV=`, no `&`).
- [X] T006 In `frontend\`, run `npm install framer-motion@13.4.6 lucide-react@1.49.0` (adds runtime dependencies to `frontend\package.json`).
- [X] T007 In `frontend\`, run `npm install -D vitest@5.0.2 vite@^8.3.1 @vitejs/plugin-react@6.1.1 vite-tsconfig-paths@6.1.1 jsdom@30.1.1 @testing-library/react@16.3.3 @testing-library/dom @testing-library/jest-dom@7.0.1 @testing-library/user-event@14.6.7 @playwright/test@1.63.0 @axe-core/playwright@4.13.0`, then `npx playwright install chromium`.
- [X] T008 [P] Set strict TypeScript in `frontend\tsconfig.json`: `"strict": true`, add `"noUncheckedIndexedAccess": true`, keep the `@/*` to `./src/*` path alias, and add `tests` to `include` so test files are type-checked.
- [X] T009 [P] Configure ESLint flat config in `frontend\eslint.config.mjs`: extend `eslint-config-next` core-web-vitals and typescript presets, set `@typescript-eslint/no-explicit-any` to `error`, keep `@next/next/no-img-element` as `error`, and ignore `.next`, `node_modules`, `playwright-report`, `test-results`.
- [X] T010 [P] Configure `frontend\next.config.ts`: `poweredByHeader: false`, `images.formats: ["image/avif", "image/webp"]`, `reactStrictMode: true`. Add no rewrites, no env, no remote image hosts.
- [X] T011 [P] Create `frontend\vitest.config.ts` (jsdom environment, `@vitejs/plugin-react`, `vite-tsconfig-paths`, `include: ["tests/unit/**/*.test.{ts,tsx}"]`, `setupFiles: ["./vitest.setup.ts"]`) and `frontend\vitest.setup.ts` (import `@testing-library/jest-dom/vitest`, stub `window.matchMedia`, auto-cleanup after each test).
- [X] T012 [P] Create `frontend\playwright.config.ts`: `testDir: "./tests/e2e"`, projects `mobile` (device `Pixel 7`) and `desktop` (device `Desktop Chrome` with viewport 1280×800), `baseURL: "http://localhost:3100"`, `webServer` with `command: "npm run build && npm run start -- --port 3100"`, `url: "http://localhost:3100"`, `timeout: 180000`, `reuseExistingServer: !process.env.CI`.
- [X] T013 Remove scaffold boilerplate: replace `frontend\src\app\page.tsx` with a minimal `<main>` placeholder, delete unused files from `frontend\public\` (`next.svg`, `vercel.svg`, `file.svg`, `globe.svg`, `window.svg` if present), delete any `frontend\AGENTS.md` or `frontend\CLAUDE.md` the scaffolder wrote, and confirm `frontend\.gitignore` ignores `node_modules`, `.next`, `test-results`, `playwright-report` (add the last two if missing). Never delete `.env*` ignore rules.
- [X] T014 Verify the scaffold: in `frontend\` run `npm run lint`, `npm run typecheck`, `npm run build` (all must pass), then from `D:\shuaib-health` run `git status --short` and confirm `node_modules` and `.next` do not appear.

**Checkpoint 1 (you review)**: In `frontend\` run `npm run dev` and open http://localhost:3000. You should see the bare placeholder page with no errors in the terminal or browser console. Confirm the eight scripts exist by running `npm run` in `frontend\`. Stop the server with Ctrl+C. Only continue when this is clean.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Design tokens, fonts, types, mock data, content layer, route registry, placeholder images and shared UI primitives that every story needs.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

### Tokens and fonts

- [X] T015 Write the design tokens in `frontend\src\app\globals.css` per design-system.md §1–§3: `@import "tailwindcss";`, an `@theme` block with all `--color-*` tokens (navy-900/800, teal-50/100/300/400/500/600/700, sky-400, blue-50/600/700, ink, muted, background, surface, border, border-strong, danger-700, danger-50), `--radius-control/card/pill`, `--shadow-soft/lift` built with `color-mix` from the navy token, `--ease-soft`, an `@theme inline` block mapping `--font-heading` and `--font-sans` to `var(--font-jakarta)` and `var(--font-inter)`, and four `@utility` gradients (`bg-brand-gradient`, `bg-accent-gradient`, `bg-deep-gradient`, `bg-soft-gradient`). Hex strings may appear only in this file.
- [X] T016 In the same `frontend\src\app\globals.css`, add base styles: body uses `font-sans`, `ink` text and `background`; headings use `font-heading` and `navy-900`; `html { scroll-padding-top }` equals the header height (4.5rem); a global `:focus-visible` ring (2 px `blue-700`, 2 px offset, and a `.on-dark` variant using `teal-300`); and an `@media (prefers-reduced-motion: reduce)` block that sets transition and animation durations to near zero and removes hover transforms.
- [X] T017 Rewrite `frontend\src\app\layout.tsx` as a minimal root layout: load `Plus_Jakarta_Sans` (variable `--font-jakarta`) and `Inter` (variable `--font-inter`) from `next/font/google` with `subsets: ["latin"]` and `display: "swap"`, apply both variables to `<html lang="en">`, import `./globals.css`, and render `{children}` in `<body>`. The full shell is added in Phase 3.

### Types, helpers and mock data

- [X] T018 [P] Create `frontend\src\types\content.ts` with the exact shapes from contracts/content-shapes.md (`ImageAsset`, `Department`, `Doctor`, `HealthTip`, `Weekday`, `OpeningHoursRule`, `PhoneNumber`, `SiteConfig`, `NavItem`) plus the home-copy types from data-model.md (`HeroFact`, `QuickAction`, `Fact`, `WhyPoint`, `IconName` as a string-literal union).
- [X] T019 [P] Create `frontend\src\lib\cn.ts` exporting `cn(...classes)` that joins truthy class strings (no dependency).
- [X] T020 [P] Create `frontend\src\lib\format.ts` exporting `formatPkr(n)` (`"PKR " + n.toLocaleString("en-US")`, integers only), `formatKarachiDate(iso)` (`Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Karachi", day: "numeric", month: "short", year: "numeric" })`), and `formatOpeningHours(rules)` (for Monday to Saturday 09:00–21:00 returns `Mon–Sat, 9 AM – 9 PM PKT`; handles any rules generically and always ends with `PKT`).
- [X] T021 [P] Create `frontend\src\lib\motion.ts` exporting shared constants: reveal duration 0.5, offset 16, stagger 0.06, max delay 0.3, and the `--ease-soft` cubic-bezier `[0.22, 1, 0.36, 1]`.
- [X] T022 [P] Create `frontend\src\data\siteConfig.ts` typed as `SiteConfig`: name `Shuaib Health`, tagline `Clinic & Diagnostics, Karachi`, fullTitle `Shuaib Health — Clinic & Diagnostics, Karachi`, demoNotice exactly `Portfolio demo — not a real clinic, not medical advice.`, emergency phone display `+92 21 0000 0000` with tel `+922100000000`, general phone `+92 21 0000 0001` / `+922100000001`, address `["Sample Road", "Karachi, Pakistan"]`, timeZone `Asia/Karachi`, opening hours Monday to Saturday 09:00–21:00 (Sunday closed), credit text `Designed & built by Shuaib Ali` with href `https://github.com/Shuaibali0786`, `indexable: false`, `isSample: true`.
- [X] T023 [P] Create `frontend\src\data\departments.ts` with the 7 departments in spec order (General Medicine, Cardiology, Pediatrics, Gynecology, Dermatology, Dental, Pathology Lab): ids like `dept-cardiology`, slugs from data-model.md, `sortOrder` 1–7, a one-line `summary` (≤ 90 characters, no claims), and `image` entries using the file names in image-manifest.md rows 3–9 (800×600, alt ends with `(placeholder image)`), all `isSample: true`.
- [X] T024 [P] Create `frontend\src\data\doctors.ts` with the 4 sample doctors from image-manifest.md rows 10–13 (Dr. Ayesha Rahman → Gynecology, Dr. Imran Qureshi → Cardiology, Dr. Sana Farooqui → Pediatrics, Dr. Hassan Mirza → General Medicine): ids `doc-<name>`, slugs `dr-<first>-<last>`, `departmentId` matching T023, `specialty` equal to the department name, `photo` 600×750, integer `feePkr` between 2000 and 3500, `isFeatured: true`, `isSample: true`. No credentials, ratings or experience fields.
- [X] T025 [P] Create `frontend\src\data\healthTips.ts` with 4 sample tips (slugs `staying-hydrated`, `healthy-sleep-habits`, `balanced-plate`, `daily-walk`), each with title (≤ 80 characters), general-wellbeing summary (≤ 160 characters, no diagnosis, dosage or treatment claims), category, `publishedAt` ISO with `+05:00` offset (four distinct dates, `daily-walk` oldest), image entries from image-manifest.md rows 14–17 (800×500), `isSample: true`.
- [X] T026 [P] Create `frontend\src\data\navigation.ts` exporting `primaryNav: NavItem[]` in spec order (Home `/`, About `/about`, Doctors `/doctors`, Departments `/departments`, Lab Tests `/lab-tests`, Health Packages `/health-packages`, Health Tips `/health-tips`, Contact `/contact`), `footerQuickLinks` (primaryNav plus Book Appointment `/book-appointment`), and `legalLinks` (Privacy `/privacy`, Terms `/terms`). The footer Departments column is derived from departments in the footer component, not stored here.
- [X] T027 [P] Create `frontend\src\data\homeContent.ts` with static UI copy per data-model.md: 3 `HeroFact`s (hours text must be produced from siteConfig via `formatOpeningHours`, not typed twice), 5 `QuickAction`s in FR-012 order with hrefs `/doctors`, `/book-appointment`, `/lab-tests`, `/health-packages`, `/home-sample-collection`, 4 `Fact`s for the honest facts band (departments count derived from data, "Online" lab reports, hours, "Same day" reports for common tests), and 5 `WhyPoint`s with no superlatives, comparisons or numbers. Use `iconName` keys, never React imports.
- [X] T028 Create `frontend\src\lib\content.ts` with the async accessors from data-model.md: `getSiteConfig`, `getDepartments` (sorted), `getDepartmentBySlug`, `getFeaturedDoctors(limit = 4)` (featured only, clamped 3–4), `getDoctorBySlug`, `getLatestHealthTips(limit = 3)` (by `publishedAt` descending, ties by id), `getHealthTipBySlug`. All return Promises. Depends on T022–T025.
- [X] T029 Create `frontend\src\lib\routes.ts` per contracts/routes.md: a `ROUTES` constant, path builders (`doctorPath`, `departmentPath`, `tipPath`), a `placeholderRoutes()` function returning `{ path, title, kind }` entries for all static paths plus slug paths generated from the data files, and `isKnownPath(path)`. Depends on T023–T026.

### Placeholder images

- [X] T030 Create `frontend\scripts\generate-placeholder-images.mjs` using `sharp` to write the 17 files in image-manifest.md at their exact pixel sizes: teal-to-navy gradient background with the text `PLACEHOLDER` and the file's own name drawn on it. Create missing folders under `frontend\public\images\{hero,clinic,departments,doctors,tips}`. If `sharp` cannot be resolved, run `npm install -D sharp` in `frontend\`.
- [X] T031 Run `npm run images:placeholders` in `frontend\`, then `dir public\images /s /b` and confirm exactly the 17 files from image-manifest.md exist and each opens as a labelled gradient.

### Shared UI primitives

- [X] T032 [P] Create `frontend\src\components\layout\Container.tsx` (max-width 75rem, horizontal padding 1rem / 1.5rem at `md` / 2rem at `xl`) and `frontend\src\components\ui\Section.tsx` (vertical spacing 4rem mobile / 6rem `lg`, optional `tone` prop `background` or `surface`, renders `<section aria-labelledby>`).
- [X] T033 [P] Create `frontend\src\components\ui\Button.tsx` per design-system.md §7: renders `next/link` (or `<a>` for `tel:`), variants `primary`, `accent`, `outline`, `danger`, `onDark`, min height 44 px, visible focus ring, no scale on press.
- [X] T034 [P] Create `frontend\src\components\ui\Card.tsx` (radius-card, shadow-soft, 1 px border, optional hover lift that is disabled under reduced motion) and `frontend\src\components\ui\SampleBadge.tsx` (pill, teal-50 background, teal-700 text and border, text `Sample`).
- [X] T035 [P] Create `frontend\src\components\ui\SectionHeading.tsx` (optional eyebrow in teal-700, `h2`, optional muted intro, `id` prop for `aria-labelledby`) and `frontend\src\components\ui\icons.ts` (a typed map from the `IconName` union to lucide-react icon components) plus `frontend\src\components\ui\IconTile.tsx` (48 px rounded tile, teal-100 background, navy `aria-hidden` icon).
- [X] T036 [P] Create `frontend\src\components\ui\ImageWithFallback.tsx` (`"use client"`): wraps `next/image`, takes an `ImageAsset` plus `sizes`, `priority`, `className`; on error swaps to a neutral `surface` block with the same aspect ratio that shows the alt text as a caption (no broken-image icon).
- [X] T037 [P] Create `frontend\src\components\ui\MotionProvider.tsx` (`"use client"`: `LazyMotion` with `domAnimation` and `MotionConfig reducedMotion="user"`) and `frontend\src\components\ui\Reveal.tsx` (`"use client"`) implementing the progressive behavior from research.md R3: children render visible on the server; after hydration only blocks below the fold start hidden and animate in once (opacity plus 16 px rise); above-the-fold blocks are never hidden; props `delay` (clamped to 0.3 s) and `as`.

### Placeholder pages and not-found (moved here from Phase 5 at your request; task IDs unchanged)

- [X] T063 [P] [US2] Create `frontend\src\components\coming-soon\ComingSoon.tsx`: inside `Container`, an `h1` `Coming soon`, the page title (for example `Lab Tests`), one sentence saying this page is not built in the demo yet, and a `Back to Home` Button to `/`; centered, calm layout using `bg-soft-gradient`.
- [X] T064 [US2] Create `frontend\src\app\[...slug]\page.tsx`: `export const dynamicParams = false`, `generateStaticParams` returning `slug` arrays from `placeholderRoutes()`, an async page that `await`s `params` (a Promise in Next 16), looks up the entry with `isKnownPath`, calls `notFound()` when unknown, and renders `ComingSoon` with the entry's title; `generateMetadata` sets title `<Title> — Coming soon` and `robots: { index: false, follow: false }`. Depends on T029, T063.
- [X] T065 [P] [US2] Create `frontend\src\app\not-found.tsx`: `h1` `Page not found`, a short apologetic sentence, and a `Back to Home` Button; rendered inside the root layout so notice bar, header and footer show once the shell exists (Phase 3); never linked from the site.

**Checkpoint 2 (you review)**: In `frontend\` run `npm run lint && npm run typecheck && npm run build` (all must pass). Run `npm run dev` and open http://localhost:3000/images/hero/hero-doctor.jpg and one file from each images folder: each shows a labelled gradient. Also open http://localhost:3000/doctors, http://localhost:3000/doctors/dr-imran-qureshi, http://localhost:3000/privacy (each shows "Coming soon" with a "Back to Home" button) and http://localhost:3000/no-such-page (shows "Page not found"). The header, notice bar and footer do not exist yet (Phase 3), and `/` is still a bare placeholder; that is expected. Open `frontend\src\app\globals.css` and glance over the tokens against design-system.md §1. Confirm the data files read well (names, fees, tip titles) since they are the copy visitors will see.

---

## Phase 3: User Story 1 - First impression and clear next step (Priority: P1) 🎯 MVP

**Goal**: A visitor on a phone sees the brand, the demo notice, a sticky header with mobile menu, the hero with both buttons and three honest fact cards, and a footer with the credit link.

**Independent Test**: Load `/` at 390 px wide: the notice bar, header (logo, call icon, menu), hero headline, and both hero buttons are visible in the first screen; at 1280 px the full navigation, emergency phone and Book Appointment button are visible; the footer shows four columns and the credit link.

### Brand

- [X] T038 [P] [US1] Create `frontend\src\components\brand\logo-paths.ts` exporting the geometry constants for the mark (rounded plus, heartbeat polyline that forms an "S") on a 64×64 viewBox, per design-system.md §4. Review the drawn shape visually at 16, 32 and 64 px in T041.
- [X] T039 [P] [US1] Create `frontend\src\components\brand\LogoMark.tsx`: inline SVG using `logo-paths.ts`, a diagonal gradient from `var(--color-teal-500)` to `var(--color-navy-900)` with a unique gradient id from `useId()`, a white heartbeat line, `aria-hidden="true"`, and a `size` prop. No hex values.
- [X] T040 [US1] Create `frontend\src\components\brand\Logo.tsx`: `LogoMark` plus the wordmark with `Shuaib` in `text-navy-900` and `Health` in `text-teal-600` (heading font, weight 800), sizes `sm`, `md`, `lg`, and a `variant` prop (`full` or `mark`). Depends on T039.
- [X] T041 [P] [US1] Create `frontend\src\app\icon.svg` from the same path data as `logo-paths.ts` (this is the only place besides `globals.css` where hex values are allowed; use the token values from design-system.md §1) and confirm it renders at 16, 32 and 64 px by opening `http://localhost:3000/icon.svg` in the dev server.
- [X] T042 [P] [US1] Create `frontend\src\app\apple-icon.tsx` (180×180 `ImageResponse` drawing the same mark). If it cannot render the mark faithfully, delete the file and note "apple icon omitted" in the Notes section at the end of this file, per research.md R9.

### Shell

- [X] T043 [P] [US1] Create `frontend\src\components\layout\SkipLink.tsx`: an `<a href="#main-content">Skip to main content</a>` that is the first focusable element, visually hidden until focused, then shown with the focus ring.
- [X] T044 [P] [US1] Create `frontend\src\components\layout\NoticeBar.tsx` (server component): full-width `navy-900` bar, centered 0.8125rem white text showing `siteConfig.demoNotice` exactly, wrapping to two lines at 320 px without clipping, not sticky.
- [X] T045 [US1] Create `frontend\src\components\layout\NavLinks.tsx` (`"use client"`): renders the `primaryNav` links, uses `usePathname()` to set `aria-current="page"` (exact match, or prefix match `href + "/"` for non-home items; Home matches only `/`), styles the active link with navy text plus a teal-500 underline bar (not color alone), and accepts a `layout` prop (`inline` or `stacked`).
- [X] T046 [US1] Create `frontend\src\components\layout\MobileMenu.tsx` (`"use client"`) per design-system.md §5: a 44×44 button with `aria-expanded`, `aria-controls`, and an accessible name ("Open menu" / "Close menu"); a disclosure panel under the header containing `NavLinks` (stacked, 48 px targets), the emergency phone `tel:` link and a full-width Book Appointment button; Escape closes and returns focus to the button; outside click closes; navigating (pathname change) closes it. Depends on T045.
- [X] T047 [US1] Create `frontend\src\components\layout\SiteHeader.tsx` (server component that reads `getSiteConfig()`): sticky `top-0`, height 64 px mobile / 72 px desktop, white with a 1 px border; logo linking to `/` with accessible name `Shuaib Health home`; below 768 px a call icon button (`aria-label="Call emergency phone"`, `tel:` link, 44×44), a compact `Book` button from 375 px up (`aria-label="Book Appointment"`, href `/book-appointment`) and the menu button; 768–1279 px adds the emergency phone text and the full Book Appointment button; at 1280 px and up shows the eight inline nav links, emergency phone and Book Appointment; `<nav aria-label="Primary">`. Add a small client wrapper only if needed for the scrolled `shadow-lift` (class toggle, no animation). Depends on T040, T045, T046.
- [X] T048 [US1] Create `frontend\src\components\layout\SiteFooter.tsx` (server component): `navy-900` background, four columns from `lg` (two at `sm`, stacked below): (1) footer `Logo` (mark variant with white wordmark treatment via a prop or on-dark variant) and a one-sentence intro with no claims, (2) Quick links from `footerQuickLinks`, (3) Departments (seven links built from `getDepartments()` and `departmentPath`), (4) Contact with the sample address, sample phone (`tel:`), opening hours from `formatOpeningHours` and a visible `Sample details` label. Bottom row: `© 2026 Shuaib Health` (year is a constant, not `new Date()`), Privacy, Terms, the demo notice text, and the credit link (`Designed & built by Shuaib Ali`, `href` from `siteConfig.credit`, `rel="noopener noreferrer"`). On-dark links use the `on-dark` focus ring.
- [X] T049 [US1] Update `frontend\src\app\layout.tsx` to the full shell: `<MotionProvider>` wrapping `SkipLink`, `NoticeBar`, `SiteHeader`, `<main id="main-content" tabIndex={-1}>{children}</main>`, `SiteFooter`. Add `metadata`: title template `%s | Shuaib Health` with default `Shuaib Health — Clinic & Diagnostics, Karachi`, a short description, `robots: { index: false, follow: false }` driven by `siteConfig.indexable`, and `viewport` with `themeColor`. Depends on T043, T044, T047, T048, T037.

### Hero

- [X] T050 [US1] Create `frontend\src\components\home\Hero.tsx`: `bg-soft-gradient`, one `h1` (headline about finding care and booking with a calm tone; no claims, no superlatives), supporting text, a primary `Book Appointment` button (`/book-appointment`) and an outline `Find a Doctor` button (`/doctors`), the hero image through `ImageWithFallback` with `priority`, `sizes` from image-manifest.md, width/height 1200×1500 (4:5), and exactly three floating fact cards from `homeContent` heroFacts (stacked below the image on mobile, floating over its edges from `lg`, `shadow-lift`, icon in `IconTile`). The hero never uses `Reveal` hidden-then-reveal. Depends on T027, T033, T036.
- [X] T051 [US1] Update `frontend\src\app\page.tsx` to render only `<Hero />` for now (other sections come in Phase 4) and set the page `metadata.title` to the full Shuaib Health title.

**Checkpoint 3 (MVP review, you run it)**: In `frontend\` run `npm run dev`, open http://localhost:3000, and use the browser device toolbar at **320, 390 and 1280 px**. Check: the notice bar text is exact; the sticky header stays on scroll; on 390 px the logo, call button, Book button and menu button fit, the menu opens/closes (also with Escape), and the hero headline and both buttons are visible without scrolling; at 1280 px all eight links, the phone and Book Appointment show; three hero cards, no counts or ratings; footer has four columns and "Designed & built by Shuaib Ali" links to https://github.com/Shuaibali0786; press Tab from the top: "Skip to main content" appears first and focus rings are visible; the logo looks right (plus sign, heartbeat "S", navy "Shuaib" and teal "Health"). Links to other pages already show "Coming soon" (built in Phase 2). Run `npm run lint && npm run typecheck && npm run build`. Give feedback on the look (logo shape, headline copy, spacing) before Phase 4.

---

## Phase 4: User Story 4 - Find a doctor, department, lab tests or emergency help from Home (Priority: P2)

**Goal**: The remaining seven Home sections, in spec order, all driven by the mock data.

**Independent Test**: On `/`, sections appear in order (quick actions, departments, facts band, why choose us with emergency card, featured doctors, health tips, CTA band); counts are 5 quick actions, 7 departments, 4 doctors each with a "Sample" badge, 3 tips each with a "Sample" badge; the emergency number is a `tel:` link; every link points at a route registered in `frontend\src\lib\routes.ts`.

- [X] T052 [P] [US4] Create `frontend\src\components\home\QuickActions.tsx`: `Section` with `SectionHeading` titled `How can we help you?`, five actions in order (Find a Doctor, Book Appointment, Lab Tests, Health Packages, Home Sample Collection) from `homeContent`, each a single-link card with `IconTile`, label and one-line description; two columns on phones (fifth spans both) and five columns from `lg`.
- [X] T053 [P] [US4] Create `frontend\src\components\home\DepartmentCard.tsx` (image 4:3 via `ImageWithFallback`, `h3` name as the stretched link to `departmentPath(slug)`, one-line summary, arrow icon) and `frontend\src\components\home\DepartmentGrid.tsx` (awaits `getDepartments()`, heading `Our departments`, one column at 320–479 px, two at `sm`, three at `lg`, four at `xl`, wrapped in `Reveal` with stagger). Image `sizes` from image-manifest.md.
- [X] T054 [P] [US4] Create `frontend\src\components\home\FactsBand.tsx`: `bg-deep-gradient` band, 2×2 on phones and four across from `lg`, value in `teal-300` heading font, label in white, using only the four honest facts from `homeContent` (departments count derived from `getDepartments()`). No patient counts, years, awards, certifications or ratings.
- [X] T055 [P] [US4] Create `frontend\src\components\home\EmergencyCard.tsx`: `danger-50` card with a `danger-700` heading and icon, the emergency number as a `Button` `danger` variant `tel:` link from `siteConfig.emergencyPhone`, and the sentence advising visitors in an emergency to go to the nearest emergency room, plus a note that the number is a sample.
- [X] T056 [US4] Create `frontend\src\components\home\WhyChooseUs.tsx`: heading `Why choose Shuaib Health`, the 4–5 `WhyPoint`s with `IconTile`, the clinic interior image (`ImageWithFallback`, 1200×900, `sizes` from image-manifest.md), and the `EmergencyCard`; mobile order is image, list, emergency card; from `lg` list left, image right, emergency card below spanning both. Depends on T055.
- [X] T057 [P] [US4] Create `frontend\src\components\home\DoctorCard.tsx`: photo 4:5, `SampleBadge`, name, specialty, fee via `formatPkr(feePkr)` with a `Consultation fee` label, and a `View profile` link to `doctorPath(slug)` (a single primary link, no nested links).
- [X] T058 [US4] Create `frontend\src\components\home\FeaturedDoctors.tsx`: heading `Featured doctors` with a short line stating these are sample doctors, awaits `getFeaturedDoctors()`, one column mobile, two at `sm`, four at `xl`, `Reveal` with stagger. Depends on T057.
- [X] T059 [P] [US4] Create `frontend\src\components\home\TipCard.tsx`: image 16:10, category, `h3` title as the link to `tipPath(slug)`, date from `formatKarachiDate(publishedAt)`, summary, and a `SampleBadge`.
- [X] T060 [US4] Create `frontend\src\components\home\HealthTips.tsx`: heading `Health tips`, awaits `getLatestHealthTips(3)`, one column mobile, three from `lg`, and a `View all tips` link to `/health-tips`. Depends on T059.
- [X] T061 [P] [US4] Create `frontend\src\components\home\CtaBand.tsx`: `bg-deep-gradient`, centered `h2` `Book your appointment`, one supporting line, and an `accent` Button to `/book-appointment`; use the `on-dark` focus ring.
- [X] T062 [US4] Update `frontend\src\app\page.tsx` to compose in spec order: `Hero`, `QuickActions`, `DepartmentGrid`, `FactsBand`, `WhyChooseUs`, `FeaturedDoctors`, `HealthTips`, `CtaBand`; alternate section tones between `background` and `surface`; wrap below-the-fold sections in `Reveal`. Depends on T050, T052–T061.

**Checkpoint 4 (you review)**: Run `npm run dev` and scroll `/` at 390 and 1280 px. Check: section order matches the spec; 7 department cards with images and one-liners; facts band has no counts of patients, awards, ratings; the emergency card number opens the dialer on a phone (or shows `tel:` in the status bar) and the ER advice is present; 4 doctor cards each marked "Sample" with fees like `PKR 3,000`; 3 tip cards marked "Sample" with Karachi dates; CTA band button is readable; below-the-fold sections fade/slide in once. Then turn on reduced motion (DevTools → Rendering → "Emulate CSS prefers-reduced-motion: reduce") and confirm nothing slides. Links to unbuilt pages already show "Coming soon". Run `npm run lint && npm run typecheck && npm run build`. Give copy and layout feedback before Phase 5.

---

## Phase 5: User Story 2 - Navigate the whole site from anywhere (Priority: P1)

**Goal**: Every link works: unbuilt destinations show "Coming soon", unknown URLs show a friendly 404. The pages themselves (T063–T065) were built in Phase 2; this phase verifies that every link on the finished Home page reaches them.

**Independent Test**: Click every header, footer and Home link (including department cards, doctor "View profile", tip cards, quick actions, CTA): none reaches a not-found page; `/definitely-not-a-page` returns 404 with the friendly page inside the site layout.

- [ ] T066 [US2] Verify the route table: in `frontend\` run `npm run build` and confirm the build output lists `/` and the `/[...slug]` static paths (all paths from contracts/routes.md, including one per doctor, department and tip). Then run `npm run start`, and in a second CMD window run `curl -s -o NUL -w "%{http_code}" http://localhost:3000/doctors` (expect 200) and `curl -s -o NUL -w "%{http_code}" http://localhost:3000/definitely-not-a-page` (expect 404). Stop the server with Ctrl+C.

**Checkpoint 5 (you review)**: Run `npm run dev` and click through everything: all eight nav links, Book Appointment (header, hero, quick action, CTA), each quick action, each department card, each doctor's View profile, each tip card, footer Quick links, footer Departments, Privacy, Terms, and `View all tips`. Every destination should show "Coming soon" (same layout, "Back to Home" works) except Home. On a "Coming soon" page confirm the current nav item is underlined for section pages such as `/doctors`. Visit `/no-such-page` and confirm the friendly not-found page. Run `npm run lint && npm run typecheck && npm run build`.

---

## Phase 6: User Story 3 (Honesty) and User Story 5 (Accessibility) - Review and hardening

**Goal**: Audit the finished pages against honesty (constitution I) and accessibility, motion and speed requirements (constitution VIII) and fix what the audit finds. Test automation for these follows in Phase 7.

**Independent Test**: A text search finds no fabricated claims; every route shows the demo notice; keyboard-only use works end to end; reduced motion removes movement; nothing scrolls sideways at 320 px; nothing uses a forbidden color pairing.

- [ ] T067 [US3] Audit for fabricated claims: from `frontend\` run `findstr /s /i /r /c:"rating" /c:"review" /c:"testimonial" /c:"award" /c:"certified" /c:"accredited" /c:"patients served" /c:"years of experience" /c:"best " /c:"leading" src\*.ts src\*.tsx` and review each hit; remove or reword any that appear in visitor-facing copy (code identifiers such as `aria-` or `review` in comments must be renamed if they would trip the Phase 7 scan). Also confirm no third-party brand name appears in `frontend\src` or in file names under `frontend\public\images`.
- [ ] T068 [US3] Confirm the demo notice appears on every page type by visiting `/`, `/doctors`, `/doctors/dr-imran-qureshi`, `/health-tips/staying-hydrated`, and `/no-such-page`, and that the footer bottom row repeats it and shows the credit link. Fix any page that misses it in `frontend\src\app\layout.tsx` or `frontend\src\components\layout\`.
- [ ] T069 [P] [US5] Motion audit: search `frontend\src` with `findstr /s /i /c:"hover:-translate" /c:"hover:scale" /c:"translate-y" src\*.tsx src\*.css` and confirm every movement or scale effect is inside a `motion-safe:` variant or disabled by the reduced-motion block in `frontend\src\app\globals.css`. Confirm `Reveal` never moves content when `prefers-reduced-motion` is set. Fix in the offending component.
- [ ] T070 [P] [US5] Keyboard and focus audit: Tab through `/` and a Coming-soon page at 390 and 1280 px; confirm order follows the visual order, a visible focus ring appears on every link and button (including on navy backgrounds via the `on-dark` variant), the mobile menu traps no focus and returns focus to its button on Escape, and focused elements are never hidden under the sticky header (`scroll-padding-top` in `frontend\src\app\globals.css`). Fix in the relevant component.
- [ ] T071 [P] [US5] Responsive audit at 320 px and at 200% browser zoom: no horizontal scrollbar, text is not clipped, the notice bar wraps, the header fits (Book button hides below 375 px and stays reachable in the menu), cards stack. Fix layout classes in the offending component under `frontend\src\components\`.
- [ ] T072 [P] [US5] Contrast audit: search for forbidden pairings with `findstr /s /i /c:"text-teal-500" /c:"text-teal-400" /c:"text-white" src\*.tsx` and confirm teal-500 or teal-400 is never used as text or as a lone icon color on light backgrounds, white text is never placed on teal-500, muted text is never placed on gradients or photos, and links use `teal-700` (design-system.md §1). Fix by switching to the approved combinations.
- [ ] T073 [P] [US5] Performance pass: confirm the hero image is the only one with `priority`, every `next/image` has `width`, `height` and `sizes`, and no component that could be a server component is marked `"use client"` unnecessarily (only `NavLinks`, `MobileMenu`, `Reveal`, `MotionProvider`, `ImageWithFallback`). Run `npm run build` in `frontend\` and check the route table's first-load JS for `/`; if it exceeds about 110 kB gzip, find the cause (for example importing all of `lucide-react` or the full `motion` bundle) and fix it.

**Checkpoint 6 (you review)**: Run `npm run build && npm run start` in `frontend\` and open http://localhost:3000 on the production build. Do a last visual and keyboard pass at 320, 390 and 1280 px, with reduced motion on and off, and at 200% zoom. Confirm the logo, colors and spacing feel premium and calm. List any copy or design changes you want before the tests are written, so tests lock in the final behavior.

---

## Phase 7: Tests (Vitest and Playwright)

**Purpose**: Turn the spec's acceptance scenarios and the constitution's testable rules into automated checks.

### Unit and component tests (Vitest, `frontend\tests\unit\`)

- [ ] T074 [P] [US3] Create `frontend\tests\unit\data.test.ts` covering data-model.md validation rules 1–8: exactly 7 departments in spec order with unique ids, slugs and sortOrder; slug pattern; doctors reference existing departments; fees are integers in range; 3–4 featured doctors; at least 3 tips with `+05:00` timestamps; every record `isSample === true`; every image has non-empty alt; `demoNotice` and `credit` equal the exact spec strings.
- [X] T075 [P] [US4] Create `frontend\tests\unit\format.test.ts` covering `formatPkr` (`PKR 2,500`, `PKR 0` edge, integer input), `formatKarachiDate` (fixed ISO in and out, including an instant just after midnight UTC that is still the same day in Karachi), and `formatOpeningHours` (`Mon–Sat, 9 AM – 9 PM PKT` for the mock rule and PKT suffix always present).
- [X] T076 [P] [US2] Create `frontend\tests\unit\routes.test.ts`: every `href` in `primaryNav`, `footerQuickLinks`, `legalLinks`, `homeContent` quick actions and all slug path builders is `/` or in `placeholderRoutes()`; no duplicate paths; `isKnownPath` rejects an unknown path; no registered placeholder path has a real page file under `frontend\src\app` (other than `[...slug]`).
- [X] T077 [P] [US5] Create `frontend\tests\unit\tokens.test.ts`: parse `frontend\src\app\globals.css`, recompute WCAG contrast for every approved pair in design-system.md §1 (≥ 4.5:1 text, ≥ 3:1 UI, wordmark teal-600 ≥ 3:1), assert forbidden pairs are not used as text tokens, assert no hex literal exists in `frontend\src\components` or `frontend\src\app` except `globals.css` and `icon.svg`, and assert no raw `<img` appears in `frontend\src`.
- [ ] T078 [P] [US3] Create `frontend\tests\unit\honesty.test.ts`: scan `frontend\src\data` and `frontend\src\components` text for banned claim words (rating, review, testimonial, award, certified, accredited, "patients served", "years of experience") and for third-party brand words; also assert `frontend\src` contains no `fetch(` and no `process.env` use (constitution V, no backend calls).
- [X] T079 [P] [US4] Create `frontend\tests\unit\images.test.ts`: every `ImageAsset.src` in the data files exists under `frontend\public`, its path matches the manifest, sizes in data match image-manifest.md, and no file in `frontend\public\images` is unreferenced.
- [X] T080 [P] [US1] Create `frontend\tests\unit\logo.test.tsx`: `Logo` renders `Shuaib` and `Health` text, the SVG is `aria-hidden`, two `LogoMark` instances on one page have different gradient ids, and the path data in `frontend\src\app\icon.svg` equals the constants in `frontend\src\components\brand\logo-paths.ts` (drift guard).
- [X] T081 [P] [US2] Create `frontend\tests\unit\header.test.tsx` (mock `next/navigation` `usePathname`): `NavLinks` renders eight links in order; `aria-current="page"` on exactly the right link for `/`, `/doctors`, `/doctors/dr-imran-qureshi`; `MobileMenu` opens on click with `aria-expanded="true"`, closes on Escape and returns focus to its button, closes on outside click, and exposes the emergency `tel:` link and Book Appointment.
- [X] T082 [P] [US3] Create `frontend\tests\unit\footer-and-notice.test.tsx`: `NoticeBar` renders exactly `Portfolio demo — not a real clinic, not medical advice.`; `SiteFooter` renders four column headings, seven department links, the `Sample details` label, Privacy and Terms links, and the credit link with `href` exactly `https://github.com/Shuaibali0786` and text `Designed & built by Shuaib Ali`.
- [X] T083 [P] [US1] Create `frontend\tests\unit\hero.test.tsx`: `Hero` renders one `h1`, a `Book Appointment` link to `/book-appointment`, a `Find a Doctor` link to `/doctors`, and exactly three fact cards whose text contains none of the banned claim words.
- [X] T084 [P] [US4] Create `frontend\tests\unit\home-sections.test.tsx`: render `QuickActions` (five links in order), `DepartmentCard` (name, summary, link), `DoctorCard` (Sample badge, `PKR` fee, View profile link), `TipCard` (Sample badge, Karachi date, link), `EmergencyCard` (a `tel:` link matching `siteConfig.emergencyPhone.tel` and the nearest-ER advice), and `ImageWithFallback` (fires an image error and shows the neutral fallback with the alt caption).
- [ ] T085 [P] [US2] Create `frontend\tests\unit\coming-soon.test.tsx`: `ComingSoon` renders `h1` `Coming soon`, the given title, and a `Back to Home` link to `/`.
- [ ] T086 Run `npm run test` in `frontend\`; fix failures in the component or the test (never weaken an assertion to pass); all tests must pass.

### End-to-end tests (Playwright, `frontend\tests\e2e\`)

- [ ] T087 [P] [US1] Create `frontend\tests\e2e\home.spec.ts` (runs in both `mobile` and `desktop` projects): notice bar text exact; header shows logo and, on desktop, the eight nav links, emergency phone and Book Appointment; on mobile the menu opens and lists all eight links; hero `h1`, both hero buttons and exactly three fact cards; section order by `h2` headings; counts (5 quick actions, 7 departments, 4 doctors each with "Sample", 3 tips each with "Sample"); emergency `tel:` link `href`; footer credit `href`.
- [ ] T088 [P] [US2] Create `frontend\tests\e2e\links.spec.ts`: from `/`, collect every internal `a[href^="/"]` in header, footer and main, request each, assert HTTP 200 and that the page does not contain the `Page not found` heading; assert `/definitely-not-a-page` returns 404 and shows the friendly page inside the site layout; assert `aria-current="page"` on exactly one nav link for `/` and `/doctors`.
- [ ] T089 [P] [US3] Create `frontend\tests\e2e\honesty.spec.ts`: for every path from the registry (list them explicitly in the test from `frontend\src\lib\routes.ts` output or a fixed list), assert the notice bar text and the footer credit link; assert the Home page text contains none of the banned claim words and no third-party brand names.
- [ ] T090 [P] [US5] Create `frontend\tests\e2e\a11y.spec.ts`: run `@axe-core/playwright` with tags `wcag2a`, `wcag2aa`, `wcag21aa`, `wcag22aa` on `/`, `/doctors` (Coming soon) and `/no-such-page` in both projects and expect zero violations; keyboard test that the first Tab stop is the skip link, activating it moves focus to `#main-content`, and on mobile Escape closes the menu and returns focus to the menu button.
- [ ] T091 [P] [US5] Create `frontend\tests\e2e\motion.spec.ts`: with `page.emulateMedia({ reducedMotion: "reduce" })`, load `/`, scroll to the bottom, and assert no revealed element has a non-`none` computed `transform` and no running animation changes `transform` (use `document.getAnimations()`); with reduced motion off, assert reveal elements do animate opacity.
- [ ] T092 [P] [US5] Create `frontend\tests\e2e\responsive.spec.ts`: at widths 320, 390 and 1280, for `/`, `/doctors` and `/no-such-page`, assert `document.documentElement.scrollWidth <= window.innerWidth` (no horizontal overflow).
- [ ] T093 Run `npm run test:e2e` in `frontend\` (it builds and serves on port 3100 by itself; stop any other process using that port first); fix product bugs found, and fix a test only when the test itself is wrong. If Playwright browsers are missing, run `npx playwright install chromium` first.

**Checkpoint 7 (you review)**: Run `npm run test` and `npm run test:e2e` yourself in `frontend\` and read the summaries. Open the Playwright report with `npx playwright show-report` if anything failed. Confirm you are happy with what the tests lock in (exact text, counts, order). Do not continue if any test is skipped or disabled without a written reason.

---

## Phase 8: Final Check and Polish

**Purpose**: The full quality gate from constitution IX and plan.md, plus manual verification.

- [ ] T094 Run `npm run lint` in `frontend\`; must finish with zero errors and zero warnings about `any` or `<img>`.
- [ ] T095 Run `npm run typecheck` in `frontend\`; must finish with zero errors.
- [ ] T096 Run `npm run test` in `frontend\`; all unit and component tests pass.
- [ ] T097 Run the resilience build in `frontend\` (constitution V): `set NEXT_PUBLIC_API_URL=http://127.0.0.1:9` then `set BACKEND_URL=http://127.0.0.1:9` then `npm run build`, then reset with `set NEXT_PUBLIC_API_URL=` and `set BACKEND_URL=`; the build must succeed and print the route table.
- [ ] T098 Run `npm run test:e2e` in `frontend\`; all Playwright tests pass on the `mobile` and `desktop` projects.
- [ ] T099 Walk through the manual checklist in `specs\001-brand-home-page\quickstart.md` §8 at 320, 390 and 1280 px and tick every item; fix any item that fails and re-run T094–T098.
- [ ] T100 Manual performance check (SC-008): run `npm run build && npm run start` in `frontend\`, open http://localhost:3000 in Chrome, run Lighthouse (Mobile, Performance), and record LCP, TBT (as an INP proxy) and CLS in the Notes section below. Targets: LCP ≤ 2.5 s, CLS ≤ 0.1. If a target is missed, fix (for example hero image size or font loading) and re-measure.
- [ ] T101 Update docs to match reality: if any file name, size, alt text or path changed, update `specs\001-brand-home-page\image-manifest.md` and `specs\001-brand-home-page\data-model.md`; if the apple icon was omitted (T042), note it in `specs\001-brand-home-page\research.md` R9; tick each finished task in this file.
- [ ] T102 Final repository check from `D:\shuaib-health`: run `git status --short` and confirm only intended files changed (no `node_modules`, `.next`, `test-results`, `playwright-report`, `.env*`); review `git diff --stat`; then tell me you are ready and I will prepare the commit (I will not commit unless you ask).

**Final checkpoint (you review)**: Run the site once more (`npm run dev`), skim every section, and confirm Feature 001 is done against the spec's success criteria SC-001 to SC-010. Decide whether to commit and open a pull request into `main`.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: no dependencies; T001–T007 run in order; T008–T012 can run in parallel after T007; T013–T014 finish it.
- **Phase 2 (Foundational)**: depends on Phase 1; blocks all stories. Inside it: T015–T017 (tokens, fonts) first; T018–T027 in parallel; T028 after T022–T025; T029 after T023–T026; T030–T031 after T018; T032–T037 in parallel after T015.
- **Phase 3 (US1, MVP)**: depends on Phase 2. Brand (T038–T042) and simple shell parts (T043–T044) are parallel; T045 → T046 → T047; T040 → T047; T048 after T040; T049 after T043, T044, T047, T048; T050 after T027, T033, T036; T051 last.
- **Phase 4 (US4)**: depends on Phase 3 (uses the layout and `Reveal`). T052–T055, T057, T059, T061 are parallel; T056 needs T055; T058 needs T057; T060 needs T059; T062 needs all of them.
- **Phase 5 (US2)**: depends on Phase 4 (so that all real links exist). Only T066 (verification) remains here; T063–T065 were moved into Phase 2 (T063 and T065 parallel; T064 after T063 and T029).
- **Phase 6 (US3, US5 hardening)**: depends on Phases 3–5. T067–T068 first (copy), T069–T073 in parallel.
- **Phase 7 (Tests)**: depends on Phase 6 so tests lock in the reviewed behavior. Unit tests T074–T085 are all parallel; T086 after them; E2E tests T087–T092 are parallel; T093 after them and after T086.
- **Phase 8 (Final)**: depends on Phase 7. T094–T098 in any order except that T098 needs a clean build; T099–T102 last.

### User Story Dependencies

- **US1 (P1)**: starts after Foundational; no other story dependency; it is the MVP.
- **US4 (P2)**: builds on US1's shell and Home page; independent of US2.
- **US2 (P1)**: needs the links created by US1 and US4 to be meaningful, but its own code (catch-all route, Coming soon, not-found, T063–T065) does not depend on them and was built in Phase 2, so no link is dead at any checkpoint.
- **US3 (P1)** and **US5 (P2)**: cross-cutting audits over everything above.

### Parallel Opportunities

- Phase 1: T008, T009, T010, T011, T012 after installs.
- Phase 2: T018–T027 (types, helpers, data), T032–T037 (UI primitives).
- Phase 3: T038, T039, T041, T042, T043, T044.
- Phase 4: T052, T053, T054, T055, T057, T059, T061.
- Phase 6: T069–T073.
- Phase 7: T074–T085 and T087–T092.

### Parallel Example: Phase 4 (Home sections)

```text
Task: "Create frontend\src\components\home\QuickActions.tsx"
Task: "Create frontend\src\components\home\DepartmentCard.tsx and DepartmentGrid.tsx"
Task: "Create frontend\src\components\home\FactsBand.tsx"
Task: "Create frontend\src\components\home\EmergencyCard.tsx"
Task: "Create frontend\src\components\home\DoctorCard.tsx"
Task: "Create frontend\src\components\home\TipCard.tsx"
Task: "Create frontend\src\components\home\CtaBand.tsx"
```

---

## Implementation Strategy

### MVP First (through Checkpoint 3)

1. Phase 1: Setup, then Checkpoint 1.
2. Phase 2: Foundational, then Checkpoint 2.
3. Phase 3: shell plus Hero (US1), then **Checkpoint 3: stop and review the MVP** at 320, 390 and 1280 px.
4. Decide on look and copy before building the remaining sections.

### Incremental Delivery

1. Phase 4 adds the rest of Home (Checkpoint 4).
2. Phase 5 verifies that no link is dead (Checkpoint 5); the Coming soon and not-found pages already exist from Phase 2.
3. Phase 6 audits honesty, accessibility, motion and speed (Checkpoint 6).
4. Phase 7 adds automated tests that lock the behavior (Checkpoint 7).
5. Phase 8 runs the full gate and manual checks.

### Working rules

- One task at a time or one parallel group; keep changes small and reviewable (constitution IX).
- Never weaken a test or lint rule to make it pass; fix the cause.
- If a task reveals a spec or plan gap (for example the mark geometry or an unsupported flag), stop, note it under Notes, and ask before deviating.

---

## Notes

- [P] tasks touch different files with no dependency on unfinished work.
- [Story] labels map each task to a user story in spec.md for traceability.
- Placeholder images are generated files; commit them so the site works after cloning.
- Record deviations here as they happen (for example "apple icon omitted", Lighthouse numbers from T100).
- **Implementation deviations, Phases 1–2** (all verified with lint, typecheck and build):
  - T003: scaffold also used `--yes --disable-git` (non-interactive; the repo already exists). The scaffolder pinned `react`/`react-dom` at 19.2.8 (its tested pair with Next 16.3.7), so React stays at 19.2.8 instead of the 19.3 named in plan.md.
  - T004: `npm` prints "eslint@9.39.5 is no longer supported" (deprecation notice). ESLint 10 is still blocked by `eslint-plugin-react`, `eslint-plugin-jsx-a11y` and `eslint-plugin-import` (no ESLint 10 peer range), so ESLint stays on 9.39.5. Revisit when those plugins support 10.
  - T005: `typecheck` is `next typegen && tsc --noEmit`, not plain `tsc --noEmit`, because `next-env.d.ts` and `.next/types` are gitignored and a fresh clone would otherwise fail.
  - T007: `@types/node` raised from the scaffold's `^20` to `^24.19.0` (Vitest 5 requires 22 or newer; matches Node 24). `jsdom` is 29.1.1, not 30.1.1: jsdom 30 requires Node 24.15+ and this machine has 24.13.0; 29.1.1 supports every Node 24.
  - T013: kept `frontend\AGENTS.md` and `frontend\CLAUDE.md` (Next.js writes and re-adds AGENTS.md on every `next dev`, so deleting them only creates churn); deleted the scaffold's default `src\app\favicon.ico` (Feature 001 ships its own icon in T041); replaced the default README.
  - T030: `sharp` is declared as an explicit dev dependency (it was only present as Next's optional dependency). The script skips existing files unless run with `--force`, so real photos are never overwritten.
  - T029/T064: the catch-all page uses `findPlaceholderRoute()` (returns the entry with its title); `isKnownPath()` also accepts `/`.
  - T037: `Reveal` uses framer-motion's tiny `animate` from `framer-motion/dom/mini` (no React state, no server-hidden content). `MotionProvider` loads the `m` features lazily, so it costs nothing until a component uses `m`.
  - T063–T065 were moved from Phase 5 into Phase 2 at your request; their task IDs did not change.
- **Implementation deviations, Phase 3** (verified in headless Chrome at 320, 390, 768 and 1280 px, with axe WCAG 2.2 AA scans: 0 violations on `/`, `/doctors` and `/no-such-page`):
  - Teal buttons: "Book Appointment" (header, hero, mobile menu) uses the `accent` variant, which is the brand teal gradient with navy text; "Find a Doctor" is the navy outline variant. The accent gradient now starts at teal-500 (`#14B8A6`) instead of teal-400, so the exact brand teal is visible in the buttons (navy on teal-500 is 6.18:1).
  - Header width: at 1280 px the eight links, phone and Book button overflowed the 75rem container by 31 px, found in the browser check. The header now uses a wider container (`--container-wide: 80rem`, `Container wide`) and tighter nav link padding. No overflow at 320, 390, 768, 1024, 1280 and 1440 px.
  - Active nav indicator uses teal-600 (3.7:1) instead of teal-500 (2.49:1) to meet the 3:1 non-text contrast rule.
  - Header Book button: below 768 px it shows "Book"; it carries `aria-label="Book Appointment"` (a plain visible-text approach computed as "BookAppointment" in the accessible name). It is hidden below 375 px and stays in the mobile menu.
  - `Button` gained a `size` prop (`md`, `sm`) because overriding padding through `className` is not reliable in Tailwind.
  - `ImageWithFallback` passes `preload` to `next/image` (Next 16 deprecated `priority`); the hero image gets a `<link rel="preload">` and is not lazy loaded. The component's own prop is still called `priority`.
  - `src/app/theme-color.ts` holds the browser theme colour (`#0B2545`) because a `<meta theme-color>` cannot use a CSS variable. Hex values are now allowed only in `globals.css`, `icon.svg`, `apple-icon.tsx` and `theme-color.ts`; `tests/unit/tokens.test.ts` enforces this and checks the three files match the navy and teal tokens.
  - `heroImage` was added to `src/data/homeContent.ts` (the hero photo is not a doctor, department or tip).
  - Tests pulled forward from Phase 7 because you asked for unit tests at this checkpoint: T077 (tokens, contrast, guardrails), T080 (logo and favicon), T081 (header, nav, mobile menu), T082 (footer, notice, skip link), T083 (hero). 70 tests pass. Because Vite now resolves the `@/*` alias natively, `vite-tsconfig-paths` was uninstalled and the config renamed to `vitest.config.mts` (ESM).
  - T042: the touch icon renders through `ImageResponse` (`/apple-icon`, 180x180) and is linked in the page head.
- **Checkpoint 3 follow-ups** (after your review):
  - The emergency number is labelled "Emergency (sample)" in the header (md and up) and in the mobile menu, and the call icon's accessible name is "Call emergency phone (sample number)". The label sits on the small line above the number, because the header at 1280 px has no spare width for text after the number. The Phase 4 Emergency card must show the same "(sample)" wording.
  - Real-image tooling: `npm run images -- check` (REAL vs placeholder, size, shape, weight) and `npm run images -- fit "<file>" <key>` (crop and resize to the exact manifest size). Placeholders now carry an EXIF marker so they can be told apart from real photos; `scripts\image-list.mjs` is the single list of expected images.
  - Hero spacing was measured with a real-style 4:5 image at 390, 768, 1024, 1280 and 1440 px: image ratio exact (no layout shift), 80 px above and below the image on desktop, 48 px above the text on phones, no overflow. On desktop the text block is vertically centred against the tall photo, so the headline starts about 245 px below the hero top at 1280 px; whether to top-align it is a design decision to make once the real photo is in.
- **Real photos added** (all 17 from Pexels, fitted with `npm run images -- fit ... --focus x,y`): `images check` reports 17 REAL, 0 problems; the originals stay in `assets\photos` (git-ignored). The `fit` command gained `--focus x,y` so faces stay whole when a tall portrait becomes a wide card. All alt texts now describe the real photos (no "placeholder image" left). Hero spacing re-measured with the real hero: unchanged and balanced (headline level with the doctor's face). Crop notes (dermatology patient mostly hidden behind the tablet, Dr. Ayesha Rahman has no headroom in the original, tight plate rim) are in `image-manifest.md`. The files were later renamed to drop the `-placeholder` suffix.
- **Implementation notes, Phase 4** (verified in headless Chrome at 320, 390, 768 and 1280 px: sections in order, 5 quick actions, 7 departments, 4 sample doctors, 3 sample tips, 16 images with none broken, all 26 internal links return 200, no horizontal overflow, 0 axe WCAG 2.2 AA violations, no console errors, scroll reveals clear after scrolling):
  - Image files were renamed to drop the `-placeholder` suffix (17 `git mv` renames) and every reference was updated (data, scripts, tests, specs). `tests/unit/images.test.ts` now checks that every referenced file exists and matches its declared size and that no image file is unreferenced.
  - `Section` gained a `spacing` prop (`compact` for the facts band); `Card` outlines the whole card when its link has keyboard focus (`has-[a:focus-visible]`); `clinicImage` was added to `homeContent.ts`.
  - The Emergency card is a plain `aside` (not `Card`) because overriding Card's background and border through `className` is unreliable in Tailwind. The call button reads "+92 21 0000 0000 (sample)" and the card says the number does not reach a real clinic.
  - Doctor cards use one stretched link with the accessible name "View profile: <name>" (the visible text "View profile" is contained in it). Department and tip cards stretch their title link over the card, so there are no nested links.
  - On phones the clinic photo comes first in "Why choose us", then the points, then the Emergency card; from lg the points are on the left and the photo on the right.
  - Tests pulled forward from Phase 7: T075 (format), T076 (routes and no dead links), T079 (images), T084 (home sections), plus an extra `why-choose-us.test.tsx` (the async Emergency card is stubbed there because jsdom cannot render async server components inside another component). 188 tests pass.
  - Observation for your review: the Home page is about 13,100 px tall on a 390 px phone (department and doctor cards are full width). If that feels long, two-column cards on phones is an easy follow-up.
- Deferred to later phases: security headers/CSP, sitemap and robots files, Open Graph images, Lighthouse CI budgets (Phase 4 of the build order); Zustand, React Hook Form and Zod (booking flow).
