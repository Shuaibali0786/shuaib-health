# Data Model: Catalog API

**Feature**: 003-catalog-api | **Date**: 2026-10-03

Postgres (Neon). All tables are created by Alembic migration `0001_catalog`. Column types and the reasons for them are in [research.md R16](./research.md). Common columns on every table (not repeated below): `id uuid PK DEFAULT gen_random_uuid()`, `created_at timestamptz NOT NULL DEFAULT now()`, `updated_at timestamptz NOT NULL DEFAULT now()` (set by the seed / application on update). Link tables have no `id` and no timestamps.

"Public" = what the API returns. `is_active = false` rows are never returned (FR-019). `slug` columns always have: `varchar(80) NOT NULL UNIQUE`, `CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$')`.

## clinic_settings (exactly one row)

| Column | Type | Rules | API field (`GET /clinic`) |
|--------|------|-------|---------------------------|
| singleton | boolean | `NOT NULL DEFAULT true UNIQUE CHECK (singleton)` | — |
| name | varchar(120) | not empty | `name` |
| tagline | varchar(200) | | `tagline` |
| full_title | varchar(200) | | `fullTitle` |
| demo_notice | varchar(200) | not empty | `demoNotice` |
| emergency_phone | jsonb | `{display, tel}`; `tel` E.164 | `emergencyPhone` |
| general_phone | jsonb | `{display, tel}` | `generalPhone` |
| address | text[] | 1–5 lines | `address` |
| time_zone | varchar(64) | valid IANA name (checked by seed and on read with `zoneinfo`) | `timeZone` |
| opening_hours | jsonb | `OpeningHoursRule[]` | `openingHours` |
| lab_hours | jsonb | `OpeningHoursRule[]` | `labHours` |
| map_area | jsonb | `{bbox:[w,s,e,n], label}` | `mapArea` |
| credit | jsonb | `{text, href}`; href https | `credit` |
| logo | jsonb | `{key, alt, width, height}` | `logo` (`ImageAsset`) — **additive** |
| brand_colors | jsonb | `{primary, accent}` as `#RRGGBB` | `brandColors` — **additive** |
| indexable | boolean | | `indexable` |
| is_sample | boolean | | `isSample` |

`OpeningHoursRule = { days: Weekday[], opens: "HH:MM", closes: "HH:MM" }`, `opens < closes`. Missing row → `GET /clinic` returns 503 `not_configured`.

## clinic_rule

| Column | Type | Rules | API field (`GET /clinic/rules`) |
|--------|------|-------|---------------------------------|
| sort_order | smallint | `UNIQUE`, ≥ 1 | `sortOrder` |
| text | varchar(300) | not empty | `text` |
| is_active | boolean | default true | — |
| is_sample | boolean | | `isSample` |

Plus `id`. Seed: five rules from `extras.json` (arrive 15 minutes early; cancel at least 2 hours before; after 3 missed appointments booking may be limited; follow test preparation instructions; for emergencies call the emergency number — do not book). Rule text never contains the clinic name or phone (those come from settings).

## department

| Column | Type | Rules | API field (`Department`) |
|--------|------|-------|--------------------------|
| slug | varchar(80) | slug rules | `slug` |
| name | varchar(120) | | `name` |
| summary | varchar(120) | ≤ 90 chars by seed check | `summary` |
| image_key / image_alt / image_width / image_height | varchar / varchar / int / int | width, height > 0 | `image` (`ImageAsset`) |
| sort_order | smallint | | `sortOrder` |
| overview | text | | `overview` |
| conditions | text[] | | `conditions` |
| services | text[] | | `services` |
| is_active | boolean | | — |
| is_sample | boolean | | `isSample` |

Derived in API: `relatedTestSlugs` from `department_related_test` (ordered; inactive tests omitted). Index: `UNIQUE(slug)`.

## doctor

| Column | Type | Rules | API field (`Doctor`) |
|--------|------|-------|----------------------|
| slug | varchar(80) | slug rules | `slug` |
| full_name | varchar(120) | | `fullName` |
| department_id | uuid FK → department `ON DELETE RESTRICT` | indexed | `departmentId` (department UUID) |
| specialty | varchar(120) | | `specialty` |
| photo_key / photo_alt / photo_width / photo_height | | | `photo` (`ImageAsset`) |
| fee_pkr | integer | `CHECK (fee_pkr >= 0)` | `feePkr` |
| qualifications | text[] | 1–5 | `qualifications` |
| experience_years | smallint | `CHECK (0..70)` | `experienceYears` |
| languages | text[] | `CHECK (languages <@ ARRAY['Urdu','English','Sindhi','Punjabi'])` | `languages` |
| bio | text | | `bio` |
| sort_order | smallint | mock array order | — |
| is_featured | boolean | | `isFeatured` |
| is_active | boolean | | — |
| is_sample | boolean | | `isSample` |

Derived: `schedule` from `doctor_weekly_schedule`. A doctor whose department is inactive is hidden too. Indexes: `UNIQUE(slug)`, `(department_id)`.

## doctor_weekly_schedule

| Column | Type | Rules | API field (`ScheduleSession`) |
|--------|------|-------|-------------------------------|
| doctor_id | uuid FK → doctor `ON DELETE CASCADE` | indexed | — |
| weekday | varchar(3) | `CHECK (weekday IN ('mon','tue','wed','thu','fri','sat','sun'))` | `day` |
| start_time | time | | `start` ("HH:MM") |
| end_time | time | `CHECK (end_time > start_time)` | `end` ("HH:MM") |
| slot_minutes | smallint | `CHECK (slot_minutes BETWEEN 5 AND 120)`; seed 15 | `slotMinutes` — **additive** |

Unique: `(doctor_id, weekday, start_time)`. No-overlap per doctor and weekday is enforced by an exclusion constraint: `EXCLUDE USING gist (doctor_id WITH =, weekday WITH =, tsrange(('2000-01-01'::date + start_time), ('2000-01-01'::date + end_time)) WITH &&)` (requires `btree_gist`, created in the migration; available on Neon). Times are wall-clock in `clinic_settings.time_zone`. API order: mon→sun, then start. Index: `(doctor_id)`, `(weekday)`.

## lab_test_category

| Column | Type | API field (`LabTestCategory`) |
|--------|------|-------------------------------|
| slug | varchar(80) | `slug` |
| name | varchar(80) | `name` |
| icon_name | varchar(40) | `iconName` |
| sort_order | smallint | — (list order) |

## lab_test

| Column | Type | Rules | API field (`LabTest`) |
|--------|------|-------|-----------------------|
| slug | varchar(80) | | `slug` |
| name | varchar(160) | | `name` |
| also_known_as | text[] | 0–6 | `alsoKnownAs` |
| category_id | uuid FK → lab_test_category `ON DELETE RESTRICT` | indexed | `categoryId` (category UUID) |
| price_pkr | integer | `CHECK (price_pkr >= 0)` | `pricePkr` |
| sample_type | varchar(80) | | `sampleType` |
| report_time | varchar(80) | | `reportTime` |
| preparation | varchar(200) | | `preparation` |
| home_collection | boolean | | `homeCollection` |
| about | varchar(300) | | `about` |
| sort_order | smallint | mock array order | — |
| is_active / is_sample | boolean | | — / `isSample` |

Derived: `relatedDepartmentIds` from `lab_test_related_department` (ordered; inactive departments omitted). Indexes: `UNIQUE(slug)`, `(category_id)`.

## health_package

| Column | Type | Rules | API field (`HealthPackage`) |
|--------|------|-------|-----------------------------|
| slug, name | | | `slug`, `name` |
| icon_name | varchar(40) | | `iconName` |
| who_for | varchar(300) | | `whoFor` |
| package_price_pkr | integer | `CHECK (>= 0)`; seed asserts ≤ sum of included tests | `packagePricePkr` |
| preparation | varchar(200) | | `preparation` |
| home_collection | boolean | | `homeCollection` |
| sort_order | smallint | | — |
| is_active / is_sample | boolean | | — / `isSample` |

Derived: `testSlugs` from `health_package_test` (ordered; inactive tests omitted). Detail endpoint also returns `tests: LabTestSummary[]` (`{id, slug, name, pricePkr, homeCollection}`) — **additive**, so the website need not make a second call. No sum/saving is stored or returned (Feature 002 rule: derived values stay derived on the client).

## Link tables

| Table | Columns | Keys / indexes |
|-------|---------|----------------|
| department_related_test | department_id FK CASCADE, lab_test_id FK CASCADE, sort_order smallint | PK `(department_id, lab_test_id)`; index `(lab_test_id)` |
| lab_test_related_department | lab_test_id FK CASCADE, department_id FK CASCADE, sort_order smallint | PK `(lab_test_id, department_id)`; index `(department_id)` |
| health_package_test | package_id FK CASCADE, lab_test_id FK RESTRICT, sort_order smallint | PK `(package_id, lab_test_id)`; index `(lab_test_id)` |

## Sample counts after seed

1 clinic settings · 5 rules · 7 departments · 9 doctors (+ their sessions) · 9 categories · 26 lab tests · 5 packages. All `is_sample = true`, `is_active = true`.

## State transitions

None in this feature (read-only). `is_active` is the only lifecycle flag; it is changed only by future admin features or directly in the database.
