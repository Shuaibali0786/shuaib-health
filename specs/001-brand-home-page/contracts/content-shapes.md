# Content Shapes (future API shapes, non-binding)

**Feature**: 001-brand-home-page | **Date**: 2026-09-30

These TypeScript-level shapes are what the mock data uses today and what a Phase 2 backend is expected to return. They are **not** an API contract: no endpoint, method or path is defined here, and Phase 2 may adjust them (with matching changes to `src/lib/content.ts` only). Field rules and relationships are in [../data-model.md](../data-model.md).

```ts
// frontend/src/types/content.ts (planned; strict TypeScript, no `any`)

export interface ImageAsset {
  src: string;      // "/images/..." path under public/ (a backend may later return absolute URLs)
  alt: string;
  width: number;
  height: number;
}

export interface Department {
  id: string;
  slug: string;
  name: string;
  summary: string;
  image: ImageAsset;
  sortOrder: number;
  isSample: boolean;
}

export interface Doctor {
  id: string;
  slug: string;
  fullName: string;
  departmentId: string;
  specialty: string;
  photo: ImageAsset;
  feePkr: number;       // whole rupees
  isFeatured: boolean;
  isSample: boolean;
}

export interface HealthTip {
  id: string;
  slug: string;
  title: string;
  summary: string;
  category: string;
  publishedAt: string;  // ISO 8601, +05:00
  image: ImageAsset;
  isSample: boolean;
}

export type Weekday = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

export interface OpeningHoursRule {
  days: Weekday[];
  opens: string;        // "HH:MM"
  closes: string;       // "HH:MM"
}

export interface PhoneNumber {
  display: string;
  tel: string;          // E.164, used in tel: links
}

export interface SiteConfig {
  name: string;
  tagline: string;
  fullTitle: string;
  demoNotice: string;
  emergencyPhone: PhoneNumber;
  generalPhone: PhoneNumber;
  address: string[];
  timeZone: "Asia/Karachi";
  openingHours: OpeningHoursRule[];
  credit: { text: string; href: string };
  indexable: boolean;
  isSample: boolean;
}

export interface NavItem {
  label: string;
  href: string;
}
```

## Example records (illustrative, final copy is written during implementation)

```json
{
  "id": "dept-cardiology",
  "slug": "cardiology",
  "name": "Cardiology",
  "summary": "Heart and blood-pressure care with routine checkups.",
  "image": {
    "src": "/images/departments/cardiology.jpg",
    "alt": "Cardiology department (placeholder image)",
    "width": 800,
    "height": 600
  },
  "sortOrder": 2,
  "isSample": true
}
```

```json
{
  "id": "doc-imran-qureshi",
  "slug": "dr-imran-qureshi",
  "fullName": "Dr. Imran Qureshi",
  "departmentId": "dept-cardiology",
  "specialty": "Cardiology",
  "photo": {
    "src": "/images/doctors/dr-imran-qureshi.jpg",
    "alt": "Portrait of sample doctor Dr. Imran Qureshi (placeholder image)",
    "width": 600,
    "height": 750
  },
  "feePkr": 3000,
  "isFeatured": true,
  "isSample": true
}
```

## Compatibility rules for Phase 2

1. Adding optional fields is allowed; removing or renaming fields requires updating the types, the data files and their tests in one change.
2. Anything the backend cannot supply at build time falls back to `src/data` (Constitution V); the frontend must never throw because a field is missing (spec edge case: a doctor without a photo shows a neutral placeholder).
3. Prices remain integers in PKR and timestamps remain ISO 8601 with the Karachi offset (Constitution III).
