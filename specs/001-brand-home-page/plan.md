# Implementation Plan: Shuaib Health Brand, Site Layout and Home Page

**Branch**: `001-brand-home-page` | **Date**: 2026-09-30 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-brand-home-page/spec.md`

**Note**: Phase 1 of the constitution build order (frontend, mock data). This plan and its design docs are the only output of `/sp.plan`; no packages are installed and no app code is written yet.

## Summary

Build the `frontend/` app: brand identity (original inline-SVG logo, teal/navy tokens), a site-wide shell (demo notice bar, sticky header with mobile menu, four-column footer, skip link), the eight-section Home page, "Coming soon" placeholders for every link that has no page yet, and a custom not-found page. All content comes from typed mock data behind async accessors, so a backend can replace it later with the same shapes. The feature makes zero network calls, so the build cannot fail because a backend is unreachable. Pages are statically generated; the only client JavaScript is the mobile menu, scroll reveal animations, and image fallback.

Key technical decisions (details and alternatives in [research.md](./research.md)):

- **Stack pins**: Next.js 16.3.7, React 19.3, Tailwind 4.3.3 (CSS-first), **TypeScript pinned to ~6.0.3** and **ESLint pinned to ^9.39** because the current ESLint plugin ecosystem does not yet support TypeScript 7 / ESLint 10.
- **Contrast-safe brand tokens**: brand teal `#14B8A6` is only 2.49:1 on white, so it is used for gradients, tiles and as a background under navy text (6.18:1). Teal text and links use a darker `teal-700` (5.47:1). See [design-system.md](./design-system.md).
- **Placeholders via one catch-all route** (`[...slug]`) fed by a route registry, so the "no dead links" rule is testable from one list and real pages automatically take over later.
- **Content layer**: typed arrays in `src/data`, read only through async accessors in `src/lib/content.ts`.

## Technical Context

**Language/Version**: TypeScript ~6.0.3 (strict, no `any`), Node.js 24 (`engines: 24.x`), React 19.3
**Primary Dependencies**: Next.js 16.3.7 (App Router), Tailwind CSS 4.3.3 + `@tailwindcss/postcss`, framer-motion 13.4.6, lucide-react 1.49, `next/font` (Plus Jakarta Sans, Inter), `next/image`, clsx-style `cn` helper (local, no dependency). Zustand, React Hook Form and Zod are in the constitution stack but are NOT needed by this feature and MUST NOT be installed yet.
**Storage**: N/A (static typed mock data; no database, no cookies, no localStorage)
**Testing**: Vitest 5 + React Testing Library + jsdom (unit/component/data), Playwright 1.63 + `@axe-core/playwright` (E2E on mobile and desktop Chromium projects)
**Target Platform**: Modern evergreen browsers, mobile-first (390 px reference, 320 px minimum); deployed later to Vercel with Root Directory `frontend`
**Project Type**: web (monorepo; this feature touches `frontend/` only)
**Performance Goals**: LCP ≤ 2.5 s, INP ≤ 200 ms, CLS ≤ 0.1 on a mid-range mobile profile (SC-008); first-load client JS kept small (target ≤ 110 kB gzip for `/`, verified from build output)
**Constraints**: Zero backend/network calls at build or run time; no hard-coded hex values in components; reduced-motion respected; WCAG 2.2 AA; Windows CMD-friendly commands and cross-platform npm scripts
**Scale/Scope**: 1 real page (`/`), 1 catch-all placeholder route (~15 known paths + slug paths from mock data), 1 not-found page, 4 sample doctors, 7 departments, 3+ sample tips, ~25 components, ~20 image placeholders

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Verified against `.specify/memory/constitution.md` v1.0.0.

- [x] **I. Honesty — PASS.** Notice bar on every page via the root layout (also repeated in the footer bottom row so it stays visible after scrolling); credit link in footer (staff login is a later feature); doctors and tips carry a visible "Sample" badge; footer contact details labelled sample; a text-scan unit test and E2E test guard against ratings, reviews, awards, certifications, patient counts and third-party brand names; logo is original.
- [x] **II. Privacy — N/A for this feature.** No data collection, auth, roles, reports, or logging. Nothing stored in the browser. Sample contact details are invalid-by-construction (no real numbers).
- [x] **III. Server truth — N/A.** Fees displayed are labelled sample display values; no booking logic exists. Formatting is PKR and times are labelled Asia/Karachi with an explicit time zone (hydration-safe).
- [x] **IV. API-first — PASS (prepared).** Content types are shaped like future API responses (ids, slugs, ISO dates with offset, integer PKR) and read via async accessors so replacing the source changes no components. No API is invented in this feature; shapes are non-binding until Phase 2.
- [x] **V. Resilience — PASS.** No fetches at build or run time; a unit test scans `src` for `fetch(` and backend env variables; CI-style check runs `npm run build` with no environment variables at all.
- [x] **VI. Security — PASS (scope-limited).** No secrets, no auth, no cookies. `.env*` already ignored (commit `0885afd`). Security headers and CSP are deferred to Phase 4 (deploy).
- [x] **VII. Databases — N/A.**
- [x] **VIII. Design/a11y — PASS with one justified partial** (see Complexity Tracking): tokens live once in `@theme` (verified by a test that also bans hex in components); axe + keyboard + reduced-motion + overflow E2E tests; `next/image` and `next/font` only; a lint/test gate bans raw `<img>`. Lighthouse CI budgets are deferred to Phase 4; SC-008 is verified with a manual Lighthouse run recorded in `quickstart.md`.
- [x] **IX. Quality — PASS.** `tsc --noEmit` strict, ESLint bans `any` (`@typescript-eslint/no-explicit-any` as error), Vitest for logic/data, Playwright for the key flows on mobile and desktop.
- [x] **X. Build order — PASS.** Phase 1 only: no backend, booking flow, staff app or login.

**Post-design re-check (after Phase 1 artifacts)**: still PASS. The design added no new dependencies beyond the stack, no network access, and no data collection.

## Project Structure

### Documentation (this feature)

```text
specs/001-brand-home-page/
├── plan.md                  # This file (/sp.plan output)
├── research.md              # Phase 0: decisions, rationale, alternatives, risks
├── data-model.md            # Phase 1: entities, validation rules, accessors
├── design-system.md         # Phase 1: tokens, contrast table, components, motion, layout
├── image-manifest.md        # Phase 1: every image file the pages expect
├── quickstart.md            # Phase 1: Windows CMD setup, run, test, verify
├── contracts/
│   ├── routes.md            # Route table + placeholder behaviour + link rules
│   └── content-shapes.md    # TypeScript-level content shapes (non-binding future API shapes)
├── checklists/
│   └── requirements.md      # Spec quality checklist (from /sp.specify)
└── tasks.md                 # Phase 2 output (/sp.tasks — NOT created by /sp.plan)
```

There is no OpenAPI file: this feature exposes no endpoints, and inventing one would break the "do not invent APIs" rule. `contracts/` documents the route contract and the content shapes instead.

### Source Code (repository root)

```text
frontend/
├── package.json                    # scripts: dev, build, start, lint, typecheck, test, test:e2e, images:placeholders
├── next.config.ts                  # images formats, poweredByHeader off, typedRoutes
├── postcss.config.mjs              # @tailwindcss/postcss
├── tsconfig.json                   # strict, noUncheckedIndexedAccess, alias @/* -> src/*
├── eslint.config.mjs               # flat config: next core-web-vitals + typescript, no-explicit-any, no raw <img>
├── vitest.config.ts                # jsdom, include tests/unit/**
├── vitest.setup.ts                 # jest-dom, matchMedia stub
├── playwright.config.ts            # projects: mobile (390), desktop (1280); webServer builds + starts on :3100
├── scripts/
│   └── generate-placeholder-images.mjs   # writes clearly labelled placeholder JPGs (sharp)
├── public/
│   └── images/
│       ├── hero/                   # hero-doctor.jpg
│       ├── clinic/                 # clinic-interior.jpg
│       ├── departments/            # <dept-slug>.jpg × 7
│       ├── doctors/                # <doctor-slug>.jpg × 4
│       └── tips/                   # <tip-slug>.jpg × 3
├── src/
│   ├── app/
│   │   ├── layout.tsx              # fonts, metadata, SkipLink, NoticeBar, SiteHeader, <main>, SiteFooter
│   │   ├── globals.css             # @import "tailwindcss"; @theme tokens; @utility gradients; base + reduced-motion
│   │   ├── page.tsx                # Home: composes the 8 sections
│   │   ├── not-found.tsx           # friendly 404 in site layout
│   │   ├── icon.svg                # favicon from the same mark paths
│   │   ├── apple-icon.tsx          # 180×180 touch icon (fallback: omit if ImageResponse cannot render the mark)
│   │   └── [...slug]/page.tsx      # "Coming soon" for registered paths; dynamicParams=false => others 404
│   ├── components/
│   │   ├── brand/                  # Logo.tsx, LogoMark.tsx, logo-paths.ts
│   │   ├── layout/                 # NoticeBar, SiteHeader, NavLinks, MobileMenu, SiteFooter, SkipLink, Container
│   │   ├── ui/                     # Button, Card, SampleBadge, SectionHeading, IconTile, Reveal, ImageWithFallback
│   │   ├── home/                   # Hero, QuickActions, DepartmentGrid, FactsBand, WhyChooseUs, EmergencyCard,
│   │   │                           # FeaturedDoctors, DoctorCard, HealthTips, TipCard, CtaBand
│   │   └── coming-soon/            # ComingSoon.tsx
│   ├── data/                       # typed mock data (sample)
│   │   ├── departments.ts
│   │   ├── doctors.ts
│   │   ├── healthTips.ts
│   │   ├── siteConfig.ts           # name, tagline, phones, address, opening hours, credit, indexable flag
│   │   ├── navigation.ts           # primary nav + footer link groups
│   │   └── homeContent.ts          # hero facts, quick actions, facts band, why-choose-us (UI copy)
│   ├── types/
│   │   └── content.ts              # ImageAsset, Department, Doctor, HealthTip, SiteConfig, OpeningHoursRule, NavItem, ...
│   └── lib/
│       ├── content.ts              # async accessors: getDepartments, getFeaturedDoctors, getLatestHealthTips, getSiteConfig
│       ├── routes.ts               # ROUTES, path builders, placeholder registry
│       ├── format.ts               # formatPkr, formatKarachiDate, formatOpeningHours
│       ├── motion.ts               # shared durations/easing/offsets
│       └── cn.ts                   # class name joiner
└── tests/
    ├── unit/                       # Vitest: data, format, routes, tokens, honesty, components
    └── e2e/                        # Playwright: home, links, a11y, motion, responsive
```

**Structure Decision**: Web application layout from the template, reduced to `frontend/` for this feature (`backend/` arrives in Phase 2). The app uses `src/` with the `@/*` alias. Tests live under `frontend/tests/{unit,e2e}` (constitution structure), not co-located, so Vitest and Playwright never pick up each other's files. Data, types and accessors are separate from components so Phase 2 only rewrites `src/lib/content.ts`.

## Design Overview

Full detail lives in the linked docs; this section is the decision index.

### Routing and placeholders ([contracts/routes.md](./contracts/routes.md))
- `/` is the only real page. Every other link target is registered in `src/lib/routes.ts` and served by `[...slug]/page.tsx` as a `ComingSoon` page (HTTP 200, `noindex`).
- `generateStaticParams` builds the list from the static route registry plus slugs from the mock data (`/doctors/<slug>`, `/departments/<slug>`, `/health-tips/<slug>`); `dynamicParams = false` makes anything else return the real 404 (`not-found.tsx`).
- When a later feature adds a real `app/about/page.tsx`, Next prefers it over the catch-all; no cleanup needed except removing the path from the placeholder registry (a unit test fails if a registered placeholder also has a real page).

### Layout shell (FR-004 – FR-010)
- Root layout order: SkipLink → NoticeBar (scrolls away) → sticky SiteHeader → `<main id="main-content">` → SiteFooter. The disclaimer is repeated in the footer bottom row so it is present even when the top bar has scrolled off.
- Header: below 1280 px a hamburger disclosure menu (`aria-expanded`, `aria-controls`, Escape and outside-click close, focus returns to the trigger, closes on navigation); phone and Book buttons visible from 768 px; on phones a call icon button and a compact "Book" button (≥ 375 px) with the full set in the menu. From 1280 px the eight links, phone and Book Appointment show inline. `aria-current="page"` marks the active link (also on placeholder pages, prefix match for nested paths).
- `html { scroll-padding-top }` equals the header height so focused elements are never hidden under the sticky header (WCAG 2.2 focus not obscured).

### Design system ([design-system.md](./design-system.md))
- Tokens only in `@theme` (colors, radii, shadows, fonts, easing). Components use utilities such as `text-navy-900`, `bg-teal-50`, `rounded-card`, `shadow-soft`; gradients are `@utility` classes. Shadows derive from the navy token via `color-mix`, so no literal color values appear anywhere else.
- Text-carrying gradients use only combinations verified at ≥ 4.5:1 (navy text on light teal→sky, white text on navy→blue-800).

### Motion (FR-029, SC-007)
- `LazyMotion` + `domAnimation` with the small `m` component; `MotionConfig reducedMotion="user"` plus a CSS `prefers-reduced-motion` block that removes CSS transitions/transforms. Reduced motion keeps at most an opacity change, never movement or scaling.
- `Reveal` is progressive: content renders visible on the server (no-JS safe); after hydration, only blocks below the fold fade/slide in once. The hero is never hidden before hydration, protecting LCP.

### Images ([image-manifest.md](./image-manifest.md))
- Every image renders through `next/image` with explicit `width`/`height`, `sizes` and alt text from data. Hero image uses `priority`; all others lazy load.
- Placeholder JPGs are generated by a script and are visibly labelled "PLACEHOLDER". Real photos replace them by overwriting the same file name, so no code changes.
- `ImageWithFallback` (client) swaps a failed image for a neutral block with the same aspect ratio and keeps the alt text as a label.

### Content layer ([data-model.md](./data-model.md), [contracts/content-shapes.md](./contracts/content-shapes.md))
- Mock arrays in `src/data`, all items `isSample: true`; components import only from `src/lib/content.ts` (async). Phase 2 swaps that file to call the API with a build-time fallback to these arrays.
- Formatting is deterministic and hydration-safe: `PKR 2,500` via a fixed formatter (not ICU-dependent) and dates via `Intl.DateTimeFormat` with `timeZone: "Asia/Karachi"`.

### Home page composition (FR-011 – FR-018)
`Hero` → `QuickActions` → `DepartmentGrid` → `FactsBand` → `WhyChooseUs` (with `EmergencyCard`) → `FeaturedDoctors` → `HealthTips` → `CtaBand`. One `h1` (hero); each section has an `h2`; card titles are `h3`. Emergency numbers are `tel:` links. Sample badges appear on doctor and tip cards; the footer contact block is labelled sample.

### Requirement traceability

| Spec area | Primary implementation | Primary verification |
|-----------|-----------------------|----------------------|
| FR-001–003 brand, tokens | `components/brand/*`, `globals.css` | `tokens.test`, `logo.test`, contrast test |
| FR-004, FR-009 notice, credit | `NoticeBar`, `SiteFooter`, `siteConfig` | `layout.test`, E2E `home.spec` (all routes) |
| FR-005–007 header, menu, current page | `SiteHeader`, `MobileMenu`, `NavLinks` | `header.test`, E2E `home.spec`, `a11y.spec` |
| FR-008, FR-010 footer, skip link | `SiteFooter`, `SkipLink` | `footer.test`, E2E keyboard test |
| FR-011–018 Home sections | `components/home/*` | `home-sections.test`, E2E `home.spec` |
| FR-019–023 data, images, honesty | `src/data`, `src/lib/content.ts`, `public/images` | `data.test`, `images.test`, `honesty.test` |
| FR-024–025 links, 404 | `[...slug]`, `routes.ts`, `not-found.tsx` | `routes.test`, E2E `links.spec` |
| FR-026–032 a11y, motion, perf | Tailwind base, `Reveal`, `next/image` | E2E `a11y`, `motion`, `responsive`; manual Lighthouse |

### Test strategy (Constitution IX)
- **Vitest** (`tests/unit`): data integrity (7 departments in spec order, unique ids/slugs, doctors reference real departments, fees are positive integers, every item `isSample`, every referenced image file exists on disk); formatters (`formatPkr`, Karachi date, opening hours); route registry (nav, footer and Home hrefs all resolve to `/` or a registered path; no registered path has a real page); design-token contrast (parse `globals.css`, assert every approved text/background pair ≥ 4.5:1 and UI pairs ≥ 3:1); repo guards (no hex literals in `src/components`/`src/app` except allowed files, no raw `<img>`, no `fetch(`/backend env usage, honesty word scan over data and components); RTL component tests listed in the traceability table.
- **Playwright** (`tests/e2e`), projects `mobile` (Pixel 7, 393×851) and `desktop` (1280×800), plus explicit 320 px overflow check: notice bar text on every registered route; nav, emergency `tel:` link, credit link `href`; section order and counts (3 hero cards, 5 quick actions, 7 departments, 4 doctors with "Sample", 3 tips); link crawler (all internal links from Home, header, footer return 200 and none render the not-found heading; a random URL returns 404 with the friendly page); axe scan (WCAG 2.2 AA tags) on Home, a Coming-soon page and not-found; keyboard test (skip link first, menu Escape and focus return); reduced-motion emulation (no transform on revealed elements); no horizontal overflow at 320/390/1280.
- **Scripts**: `dev`, `build`, `start`, `lint` (`eslint .`), `typecheck` (`tsc --noEmit`), `test` (`vitest run`), `test:e2e` (`playwright test`), `images:placeholders`.

### Risks and mitigations (top 3)
1. **Toolchain drift** (TypeScript 7 / ESLint 10 published as `latest`, plugins not yet compatible) → pin TypeScript ~6.0.3 and ESLint ^9.39.5, verify with `npm ls` and a clean `npm run lint && npm run typecheck && npm run build` at scaffold time; blast radius: dev tooling only.
2. **Brand teal fails AA as text** → role-based tokens plus an automated contrast test; blast radius: visual polish only, caught in CI.
3. **Google Fonts fetch at build time** (`next/font/google`) fails when offline → acceptable on Vercel/CI; if it blocks local offline work, switch the two fonts to `next/font/local` (same CSS variables, no component change).

## Complexity Tracking

> Fill ONLY if Constitution Check has violations that must be justified

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Lighthouse CI budgets (Constitution VIII test) deferred to Phase 4 | Adds a CI runner, headless Chrome dependency and budget tuning that is better done once against the deployed Vercel preview | Running Lighthouse manually for this feature (recorded in `quickstart.md`) still verifies SC-008 now, and Phase 4 adds the automated gate |
| TypeScript and ESLint pinned below the newest majors | Ecosystem compatibility (typescript-eslint `<6.1.0`; React/JSX-a11y/import plugins without ESLint 10 support) | Using `latest` would make `npm run lint` fail or run unsupported |
