# Data Model: Website Data-Access Layer

**Feature**: 004-catalog-api-integration | **Date**: 2026-10-03

The website does not own catalog data after this feature. This document describes the **frontend-side** shapes: what the API returns, how each resource is cached, and what components receive.

## 1. Source shapes (from the contract)

Generated into `frontend/src/lib/api/schema.gen.ts` from `specs/003-catalog-api/contracts/openapi.yaml`. Base path `/api/v1`.

| Resource | Endpoint used | Item schema | Envelope |
|---|---|---|---|
| Clinic settings | `GET /clinic` | `ClinicSettings` | single object |
| Clinic rules | `GET /clinic/rules?pageSize=100` | `ClinicRule` `{id, sortOrder, text, isSample}` | `ClinicRulePage` |
| Departments | `GET /departments?pageSize=100` | `Department` | `DepartmentPage` |
| Doctors | `GET /doctors?pageSize=100` | `Doctor` (incl. `schedule[]` with additive `slotMinutes`) | `DoctorPage` |
| Lab test categories | `GET /lab-test-categories?pageSize=100` | `LabTestCategory` | `LabTestCategoryPage` |
| Lab tests | `GET /lab-tests?pageSize=100` | `LabTest` | `LabTestPage` |
| Health packages | `GET /health-packages?pageSize=100` | `HealthPackage` | `HealthPackagePage` |

Page envelope: `{ items: T[], total: number, page: number, pageSize: number }`. Pages 2..⌈total/100⌉ are fetched in parallel and concatenated in page order. All pages of one resource share **one** 3 s deadline (a single `AbortSignal`), so a long list never makes a render wait more than 3 s (FR-011).

Detail endpoints (`/{resource}/{slug}`) are **not used** (research R3).

## 2. Validation rules (zod, `src/lib/api/schemas.ts`)

- Each zod schema mirrors one generated component type; `z.infer<Schema>` must equal the generated type (type-level contract test).
- Unknown extra fields are **stripped** (forward-compatible with additive API changes); missing or mistyped required fields **fail** the whole resource → treated as an outage (FR-015).
- Slugs: `^[a-z0-9]+(?:-[a-z0-9]+)*$`; prices: non-negative integers (PKR); colours: `^#[0-9A-Fa-f]{6}$`; image `src` must start with `/images/` (images stay local, research R8). Anything else is rejected.

## 3. Mapping to component types (`src/types/content.ts`)

Components keep receiving the existing types (FR-042). Mapping is identity except:

| Content type | Change | Notes |
|---|---|---|
| `SiteConfig` | **add** optional `logo?: ImageAsset`, `brandColors?: {primary; accent}` | Additive; existing components ignore them. Used in metadata / JSON-LD. |
| `ScheduleSession` | **add** optional `slotMinutes?: number` | Additive; not displayed. |
| `ClinicRule` | **new** `{ id: string; sortOrder: number; text: string; isSample: boolean }` | Rendered by `BeforeYourVisit`. |
| `Department`, `Doctor`, `LabTestCategory`, `LabTest`, `HealthPackage`, `ImageAsset` | none | IDs are now random strings; only compared for equality. |

## 4. Cache entries (`src/lib/api/cached.ts`)

All entries use `unstable_cache` with `revalidate: getDataRevalidateSeconds()`. That is **300** by default and in production. `CATALOG_DATA_REVALIDATE_SECONDS` (an integer from 1 to 3600) overrides it only for the stateful e2e server, which uses 3. Route segment `revalidate` stays the literal `300` everywhere.

| Cache key | Tags | Loader | Used by |
|---|---|---|---|
| `["api","clinic"]` | `catalog`, `clinic` | `GET /clinic` | layout, header, footer, notice bar, contact, home, metadata, OG images, robots, sitemap |
| `["api","clinic-rules"]` | `catalog`, `clinic-rules` | `GET /clinic/rules` | contact, book-appointment |
| `["api","departments"]` | `catalog`, `departments` | `GET /departments` | home, departments list/detail, doctors filter, lab-test detail, sitemap |
| `["api","doctors"]` | `catalog`, `doctors` | `GET /doctors` | home featured, doctors list/detail, department detail, sitemap |
| `["api","lab-test-categories"]` | `catalog`, `lab-test-categories` | `GET /lab-test-categories` | lab tests list |
| `["api","lab-tests"]` | `catalog`, `lab-tests` | `GET /lab-tests` | lab tests list/detail, packages, sitemap |
| `["api","health-packages"]` | `catalog`, `health-packages` | `GET /health-packages` | packages page, lab-test detail |

The tags let a future admin feature call `revalidateTag("doctors", "max")` (out of scope now).

## 5. Result type and state transitions

```ts
type Loaded<T> = { ok: true; data: T } | { ok: false; reason: "unconfigured" | "unavailable" };
```

Per resource, as seen by a page render:

```text
              success                         success
 [EMPTY] ─────────────▶ [FRESH] ──(300 s)──▶ [STALE] ─────────▶ [FRESH]
    │                                          │
    │ failure (timeout/network/non-200/invalid) │ failure
    ▼                                          ▼
 Loaded{ok:false}                       stale value returned (last good) — Loaded{ok:true}
 → friendly message / fallback          → no visible change
```

- `EMPTY` exists only before the first success on a deployment (fresh start or build without API).
- `unconfigured` = `CATALOG_API_URL` unset (same UI as `unavailable`; a distinct server log line).

### Clinic settings precedence (FR-022)

1. Live/last-good API value (`Loaded.ok`), else
2. `CLINIC_FALLBACK_JSON` if present and valid against the `ClinicSettings` schema, else
3. Neutral identity: name "Clinic", no phones (emergency/general UI hidden), empty address, `demoNotice: DEMO_NOTICE`, `credit: CREDIT` (see below). `console.warn` once per render.

### Honesty text (constitution I)

`src/lib/honesty.ts` exports the constitution text:
- `DEMO_NOTICE = "Portfolio demo — not a real clinic, not medical advice."`
- `CREDIT = { text: "Designed & built by Shuaib Ali", href: "https://github.com/Shuaibali0786" }`

The notice bar, footer and OG images **always render these constants**, whatever `SiteConfig.demoNotice`/`credit` hold in live, last-good, fallback or neutral data. A database edit therefore cannot remove or change them. The API fields stay in the type for contract parity. A unit test checks that the recorded seed values equal the constants, so the seed and the site cannot silently diverge.

## 6. Lookups derived from lists (unchanged semantics)

| Function (`src/lib/content.ts`, same names as today) | Derivation |
|---|---|
| `getDepartments()` | departments sorted by `sortOrder` |
| `getDepartmentBySlug(slug)` | find in list; `undefined` ⇒ `notFound()` only when list `ok` |
| `getFeaturedDoctors(limit)` | `isFeatured`, clamp 3–4 |
| `getDoctors()`, `getDoctorBySlug`, `getDoctorsByDepartment(id)` | list / find / filter |
| `getLabTestCategories()`, `getLabTests()`, `getLabTestBySlug`, `getLabTestsBySlugs` | list / find / ordered pick, unknown slugs skipped |
| `getHealthPackages()`, `getPackagesIncludingTest(slug)` | list / filter |
| `getSiteConfig()` | clinic precedence above (always returns a `SiteConfig`) |
| `getClinicRules()` **(new)** | sorted by `sortOrder`; `[]` when unavailable |

To express "unavailable" without changing every component, catalog accessors return `Loaded<T>` through **new** `load*` functions (`loadDoctors()`, …). The existing `get*` names remain as thin helpers for code paths that only need data-or-empty (e.g. sitemap, `generateStaticParams`). Pages choose: `ok` → render as today; `!ok` → `<DataUnavailable />` in that section only (partial outage, spec edge case).
