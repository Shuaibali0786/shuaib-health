# Data Model: Public Pages

**Feature**: 002-public-pages | **Date**: 2026-10-02

All data is typed static content in `frontend/src/data`, read only through async accessors in `frontend/src/lib/content.ts` (Feature 001 pattern). Every record has `isSample: true` and a stable `id` and `slug`. Shapes are written so a Phase 2 API can return the same JSON; they are not a published contract (see [contracts/content-shapes.md](./contracts/content-shapes.md)).

## Entities

### Doctor (extends Feature 001)
| Field | Type | Rules |
|-------|------|-------|
| id, slug, fullName, departmentId, specialty, photo, feePkr, isFeatured, isSample | existing | slug `dr-first-last`; `isFeatured` stays true only for the original four |
| qualifications | `string[]` (1–3) | generic degree titles only (e.g. "MBBS", "FCPS (Medicine)"); no institutions, registration numbers |
| experienceYears | integer 3–30 | labelled sample wherever shown |
| languages | `Language[]` (1–4) | `"Urdu" \| "English" \| "Sindhi" \| "Punjabi"` |
| bio | `string` | 2–3 sentences, no claims of outcomes, no superlatives |
| schedule | `ScheduleSession[]` (≥ 2) | see below |

Relationships: belongs to one Department. Derived: `availableDays` (set of weekdays from `schedule`), next available day (client).

### ScheduleSession
`{ day: Weekday; start: "HH:MM"; end: "HH:MM" }` — `day` in `mon..sat` (never `sun`), `09:00 ≤ start < end ≤ 21:00`, all in Asia/Karachi; no overlaps on one day.

### Department (extends Feature 001)
Adds: `overview: string` (2–3 sentences), `conditions: string[]` (5–8, general list), `services: string[]` (5–8), `relatedTestSlugs: string[]` (≥ 3, each a real LabTest slug). Doctors are derived (`doctor.departmentId`), not stored. Rules: ≥ 1 doctor; General Medicine and Pediatrics have exactly 2.

### LabTestCategory
`{ id, slug, name, iconName }` — exactly nine, in this order: Blood, Diabetes, Heart, Liver, Kidney, Thyroid, Vitamins, Hormones, Urine.

### LabTest
| Field | Type | Rules |
|-------|------|-------|
| id, slug, name | string | unique; slug kebab-case |
| alsoKnownAs | `string[]` (0–4) | searchable |
| categoryId | string | one of the nine |
| pricePkr | integer | 300–6,000, labelled sample |
| sampleType | string | e.g. "Blood", "Urine", "Blood (fasting)" |
| reportTime | string | e.g. "Same day", "24 hours", "2 working days" |
| preparation | string | e.g. "10–12 hours fasting", "No preparation needed"; logistics only |
| homeCollection | boolean | |
| about | string | one sentence on what the test is *for*; no interpretation, no ranges |
| relatedDepartmentIds | `string[]` | ≥ 1 |
| isSample | boolean | true |

Derived: packages that include the test; ≥ 24 tests overall, ≥ 2 per category.

### HealthPackage
| Field | Type | Rules |
|-------|------|-------|
| id, slug, name, iconName | string | five: Basic Health Check, Diabetes Care, Heart Check, Women's Health, Senior Citizen |
| whoFor | string | one or two sentences |
| testSlugs | `string[]` (4–10) | all must resolve to LabTests; no duplicates |
| packagePricePkr | integer | must be ≤ derived sum |
| preparation | string | consistent with the included tests (fasting if any included test needs fasting) |
| homeCollection | boolean | true only if every included test allows home collection |
| isSample | boolean | true |

Derived (never stored): `sumPkr = Σ test.pricePkr`, `savingPkr = sumPkr − packagePricePkr`.

### HealthTip / Article (extends Feature 001)
Adds `body: ArticleBlock[]` where `ArticleBlock = { type: "heading"; text } | { type: "paragraph"; text } | { type: "list"; items: string[] }`. Rules: 250–400 words, general lifestyle information only (no dosage, diagnosis or treatment claims), ≥ 6 articles, categories drawn from Nutrition, Sleep, Activity, Hygiene, Mental wellbeing (each has ≥ 1 article). `publishedAt` stays ISO with `+05:00`; new articles are dated before 2026-08-14 so Home's "latest three" is unchanged. Derived: reading minutes; related articles (same category first, then newest, max 3, never itself).

New articles: `hand-hygiene` (Hygiene, image `/images/tips/hand-hygiene.jpg`), `managing-stress` (Mental wellbeing, image `/images/tips/managing-stress.jpg`).

### FaqGroup / FaqItem
`FaqGroup { id, slug, title, items: FaqItem[] }`, `FaqItem { id, question, answer: string }`. Five groups with slugs `appointments`, `lab-tests-reports`, `payments`, `home-sample-collection`, `privacy`; ≥ 3 items each; answers are demo content that never claims a live service.

### LegalContent
`{ slug: "privacy" | "terms", title, lastUpdated: ISO date, intro, sections: { id, heading, blocks: ArticleBlock[] }[] }`. Privacy sections (required topics): data a real app would collect; how health data is protected; roles and what each can see; lab report access; cookies and this demo. Terms sections: purpose of the demo; sample content; no medical advice; using the site; bookings and payments not live; limits of responsibility.

### AboutContent
`{ mission, story: string[], values: { id, title, text }[] (3–5), facilityPhotos: { image, caption }[] (existing images, captions "Illustrative image …"), visitSteps: { id, title, text }[] (5) }`. Contains no founding date, counts, awards, accreditations.

### ContactContent / SiteConfig additions
`siteConfig` gains `labHours: OpeningHoursRule[]` (Mon–Sat 08:00–20:00, sample) and `mapArea: { bbox: [number, number, number, number]; label: string }`. Existing `openingHours` (Mon–Sat 09:00–21:00), phones and address are reused.

### ContactMessage (form input only)
`{ name, contact, subject, message }` validated by `contactSchema` (name 2–80, contact = valid phone or email, subject 3–100, message 10–1,000, all trimmed). Never sent, never stored.

### PageManifestEntry (derived)
`{ path, title, description, kind: "static" | "doctor" | "department" | "lab-test" | "tip", lastModified? }`.

## Accessors (`lib/content.ts`, all async)

`getDoctors()`, `getDoctorBySlug` (exists), `getDoctorsByDepartment(departmentId)`, `getDepartments` / `getDepartmentBySlug` (exist), `getLabTestCategories()`, `getLabTests()`, `getLabTestBySlug(slug)`, `getLabTestsByIds/Slugs(slugs)`, `getPackagesIncludingTest(slug)`, `getHealthPackages()`, `getHealthTips()`, `getHealthTipBySlug` (exists), `getRelatedTips(slug, limit = 3)`, `getFaqGroups()`, `getLegalContent(slug)`, `getAboutContent()`. Pure helpers (not accessors) live in `lib/filters.ts`, `lib/packages.ts`, `lib/schedule.ts`, `lib/readingTime.ts`.

## Invariants (each enforced by a test)

1. 9 doctors; each department has ≥ 1; General Medicine and Pediatrics have 2; four original photos unchanged; every photo file exists with its declared size.
2. Every schedule session is Mon–Sat, inside 09:00–21:00, no overlaps.
3. Every `relatedTestSlugs`, package `testSlugs`, article cross-reference resolves; slugs and ids are unique per collection.
4. For every package: displayed sum equals the sum of catalog prices; `packagePricePkr ≤ sumPkr`; `homeCollection` implies all included tests allow it.
5. ≥ 24 tests, all nine categories populated (≥ 2), prices integers in 300–6,000.
6. ≥ 6 articles, 250–400 words, every category used by at least one article, no forbidden phrases.
7. All records `isSample: true`; no text matches the forbidden-claims scan (rated, award, accredited, certified, JCI, ISO, patients served, PMDC, registration number, real institution names list).
8. Images: `images.test` counts 24 referenced files (17 + 5 doctors + 2 tips) and finds no unreferenced file.
