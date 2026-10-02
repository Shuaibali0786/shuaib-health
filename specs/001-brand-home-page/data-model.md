# Data Model: Shuaib Health Brand, Site Layout and Home Page

**Feature**: 001-brand-home-page | **Date**: 2026-09-30

Sample content lives in typed files under `frontend/src/data`, with types in `frontend/src/types/content.ts`. Components read it only through the async accessors in `frontend/src/lib/content.ts`. The shapes are meant to match future API responses, but they are **not a published API contract** until Phase 2 (see [contracts/content-shapes.md](./contracts/content-shapes.md)).

## Conventions

- Field names are camelCase. Every record has a string `id` and, when it has its own page, a kebab-case `slug` matching `^[a-z0-9]+(-[a-z0-9]+)*$`.
- Money is a whole-number amount in PKR (`feePkr`); no floats, no currency symbol in data.
- Timestamps are ISO 8601 with the Karachi offset, for example `2026-09-12T09:00:00+05:00`.
- Every mock record carries `isSample: true`. A real backend record would carry `false`. UI rules: doctor and tip cards show a visible "Sample" badge whenever `isSample` is true; site contact details show a "Sample details" label when `SiteConfig.isSample` is true.
- Images are described by `ImageAsset`; `src` is a path under `frontend/public` (see [image-manifest.md](./image-manifest.md)).

## Entities

### ImageAsset

| Field | Type | Rules |
|-------|------|-------|
| `src` | string | Starts with `/images/`; the file MUST exist in `public/` |
| `alt` | string | Non-empty, describes the subject; while a placeholder, it says so (for example "Cardiology department (placeholder image)") |
| `width` | number | Positive integer, intrinsic pixel width |
| `height` | number | Positive integer, intrinsic pixel height |

### Department

| Field | Type | Rules |
|-------|------|-------|
| `id` | string | Unique, for example `dept-cardiology` |
| `slug` | string | Unique kebab-case, used in `/departments/<slug>` |
| `name` | string | Display name |
| `summary` | string | One line, ≤ 90 characters |
| `image` | ImageAsset | Card photo, 4:3 |
| `sortOrder` | number | Unique; defines display order |
| `isSample` | boolean | `true` in mock data |

Required set and order (FR-013): General Medicine, Cardiology, Pediatrics, Gynecology, Dermatology, Dental, Pathology Lab. Slugs: `general-medicine`, `cardiology`, `pediatrics`, `gynecology`, `dermatology`, `dental`, `pathology-lab`.

### Doctor

| Field | Type | Rules |
|-------|------|-------|
| `id` | string | Unique, for example `doc-ayesha-rahman` |
| `slug` | string | Unique kebab-case, used in `/doctors/<slug>` |
| `fullName` | string | Includes "Dr." prefix; invented name |
| `departmentId` | string | MUST reference an existing `Department.id` |
| `specialty` | string | Display label, equals the department name in mock data |
| `photo` | ImageAsset | Portrait, 4:5 |
| `feePkr` | number | Integer, 500 ≤ fee ≤ 50,000 (mock data: 2,000–3,500) |
| `isFeatured` | boolean | Home shows featured doctors |
| `isSample` | boolean | `true` in mock data |

Rules: 3 or 4 doctors are featured (FR-016); mock data provides 4. No credentials, ratings, years of experience or patient counts exist as fields, so they cannot be shown.

### HealthTip

| Field | Type | Rules |
|-------|------|-------|
| `id` | string | Unique, for example `tip-staying-hydrated` |
| `slug` | string | Unique kebab-case, used in `/health-tips/<slug>` |
| `title` | string | ≤ 80 characters |
| `summary` | string | ≤ 160 characters, general wellbeing wording only (no diagnosis, dosage or treatment claims) |
| `category` | string | For example "Nutrition" |
| `publishedAt` | string | ISO 8601 with `+05:00` offset |
| `image` | ImageAsset | 16:10 |
| `isSample` | boolean | `true` in mock data |

Rules: the Home page shows the 3 most recent by `publishedAt` (descending); ties break by `id`. Mock data provides at least 4 tips so "latest 3" is a real selection. Tip text is generic lifestyle content and carries the sample badge.

### OpeningHoursRule

| Field | Type | Rules |
|-------|------|-------|
| `days` | array of `"mon"\|"tue"\|"wed"\|"thu"\|"fri"\|"sat"\|"sun"` | Non-empty, no duplicates across rules |
| `opens` | string | `HH:MM`, 24-hour |
| `closes` | string | `HH:MM`, later than `opens` |

`SiteConfig.timeZone` is always `"Asia/Karachi"`. Mock rule: Monday to Saturday, 09:00–21:00; Sunday closed. `formatOpeningHours` renders "Mon–Sat, 9 AM – 9 PM PKT" (always suffixed PKT).

### SiteConfig

| Field | Type | Rules |
|-------|------|-------|
| `name` | string | "Shuaib Health" |
| `tagline` | string | "Clinic & Diagnostics, Karachi" |
| `fullTitle` | string | "Shuaib Health — Clinic & Diagnostics, Karachi" |
| `demoNotice` | string | Exactly "Portfolio demo — not a real clinic, not medical advice." |
| `emergencyPhone` | `{ display: string; tel: string }` | Invalid-by-construction sample number, `tel` in E.164 form |
| `generalPhone` | `{ display: string; tel: string }` | Same rule |
| `address` | string[] | Address lines, sample |
| `timeZone` | `"Asia/Karachi"` | Literal |
| `openingHours` | OpeningHoursRule[] | See above |
| `credit` | `{ text: string; href: string }` | Text "Designed & built by Shuaib Ali"; href `https://github.com/Shuaibali0786` |
| `indexable` | boolean | `false` (research R13) |
| `isSample` | boolean | `true` |

### NavItem

| Field | Type | Rules |
|-------|------|-------|
| `label` | string | Visible text |
| `href` | string | Internal path present in the route registry, or `/` |

Primary nav order (FR-005): Home, About, Doctors, Departments, Lab Tests, Health Packages, Health Tips, Contact. Footer "Quick links" reuses the primary nav plus Book Appointment. Footer "Departments" is derived from `Department` (name and slug), so the two lists cannot drift. Bottom-row links: Privacy (`/privacy`), Terms (`/terms`).

### Home page copy types (not API-shaped; static UI copy in `src/data/homeContent.ts`)

| Type | Fields | Notes |
|------|--------|-------|
| `HeroFact` | `id`, `label`, `iconName` | Exactly 3. Labels: "Open Mon–Sat, 9 AM – 9 PM", "Lab reports online", "Home sample collection" (the hours label is generated from `SiteConfig`, not typed twice) |
| `QuickAction` | `id`, `label`, `description`, `href`, `iconName` | Exactly 5 in FR-012 order |
| `Fact` | `id`, `value`, `label` | Exactly 4 (FR-014): `7` / "Departments" (value derived from department count), "Online" / "Lab reports", hours / "Karachi time (PKT)", "Same day" / "Reports for common tests" |
| `WhyPoint` | `id`, `title`, `text`, `iconName` | 4 or 5 (FR-015); no superlatives, no comparative claims, no numbers |

`iconName` is a key into a local map of lucide-react icons, so data files stay plain data and never import React components.

### Route registry entry (in `src/lib/routes.ts`)

| Field | Type | Rules |
|-------|------|-------|
| `path` | string | Starts with `/`, no trailing slash |
| `title` | string | Shown on the Coming-soon page and in metadata |
| `kind` | `"static" \| "doctor" \| "department" \| "tip"` | Dynamic kinds are generated from data slugs |

## Relationships

```text
Department 1 ──── * Doctor        (Doctor.departmentId -> Department.id)
Department 1 ──── * FooterLink     (derived, not stored)
SiteConfig 1 ──── * OpeningHoursRule
NavItem  * ──────> RouteRegistry   (every href is "/" or a registered path)
Doctor / Department / HealthTip ─> RouteRegistry (slug paths generated from data)
Doctor / Department / HealthTip / hero / clinic ─> ImageAsset -> file in public/images
```

## Accessors (`src/lib/content.ts`)

All return Promises so a future API can replace them without touching components.

| Accessor | Returns | Behaviour |
|----------|---------|-----------|
| `getSiteConfig()` | `SiteConfig` | |
| `getDepartments()` | `Department[]` | Sorted by `sortOrder` |
| `getDepartmentBySlug(slug)` | `Department \| undefined` | |
| `getFeaturedDoctors(limit = 4)` | `Doctor[]` | `isFeatured` only, stable order, clamped to 3–4 |
| `getDoctorBySlug(slug)` | `Doctor \| undefined` | |
| `getLatestHealthTips(limit = 3)` | `HealthTip[]` | `publishedAt` descending |
| `getHealthTipBySlug(slug)` | `HealthTip \| undefined` | |

Phase 2 note: these functions will later call the backend with a caught failure that falls back to the arrays in `src/data`, so the build never fails when the backend is unreachable (Constitution V).

## Validation rules enforced by tests (`tests/unit/data.test.ts`)

1. Exactly 7 departments, in the spec order, unique `id`/`slug`/`sortOrder`.
2. Every `slug` matches the slug pattern and is unique within its type.
3. Every `Doctor.departmentId` resolves; `feePkr` is an integer within range; 3–4 doctors are featured.
4. At least 3 tips; `publishedAt` parses and has the `+05:00` offset.
5. Every record has `isSample === true` (mock set), and every doctor and tip card renders the "Sample" badge.
6. Every `ImageAsset.src` exists on disk, has non-empty alt text, and the file name contains no third-party brand word.
7. `SiteConfig.demoNotice` and `credit` equal the exact strings from the spec.
8. Text in data and components contains none of the banned claim words (rating, review, testimonial, award, certified, accredited, "patients served", and similar).
