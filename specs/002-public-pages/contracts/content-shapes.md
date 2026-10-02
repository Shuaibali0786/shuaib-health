# Content Shapes: Feature 002

**Feature**: 002-public-pages | **Date**: 2026-10-02

TypeScript-level shapes added to or changed in `frontend/src/types/content.ts`. They are written to match what a future backend would return, but they are **not** a published API contract (no endpoints exist yet; see Constitution IV). Feature 001 shapes not listed here are unchanged.

```ts
export type Language = "Urdu" | "English" | "Sindhi" | "Punjabi";

export interface ScheduleSession {
  /** Never "sun": the sample clinic is closed on Sundays. */
  day: Exclude<Weekday, "sun">;
  /** 24-hour "HH:MM" in Asia/Karachi, within 09:00–21:00. */
  start: string;
  end: string;
}

export interface Doctor {
  // existing fields: id, slug, fullName, departmentId, specialty, photo, feePkr, isFeatured, isSample
  /** Generic degree titles only, for example ["MBBS", "FCPS (Medicine)"]. */
  qualifications: string[];
  experienceYears: number;
  languages: Language[];
  bio: string;
  schedule: ScheduleSession[];
}

export interface Department {
  // existing fields: id, slug, name, summary, image, sortOrder, isSample
  overview: string;
  conditions: string[];
  services: string[];
  /** LabTest slugs, at least three. */
  relatedTestSlugs: string[];
}

export interface LabTestCategory {
  id: string;
  slug: string;
  name: string;
  iconName: IconName;
}

export interface LabTest {
  id: string;
  slug: string;
  name: string;
  alsoKnownAs: string[];
  categoryId: string;
  /** Whole PKR, sample price. */
  pricePkr: number;
  sampleType: string;
  reportTime: string;
  preparation: string;
  homeCollection: boolean;
  about: string;
  relatedDepartmentIds: string[];
  isSample: boolean;
}

export interface HealthPackage {
  id: string;
  slug: string;
  name: string;
  iconName: IconName;
  whoFor: string;
  testSlugs: string[];
  /** Whole PKR, sample price; never above the sum of the included tests. */
  packagePricePkr: number;
  preparation: string;
  homeCollection: boolean;
  isSample: boolean;
}

export type ArticleBlock =
  | { type: "heading"; text: string }
  | { type: "paragraph"; text: string }
  | { type: "list"; items: string[] };

export interface HealthTip {
  // existing fields: id, slug, title, summary, category, publishedAt, image, isSample
  body: ArticleBlock[];
}

export interface FaqItem { id: string; question: string; answer: string }
export interface FaqGroup { id: string; slug: string; title: string; items: FaqItem[] }

export interface LegalSection { id: string; heading: string; blocks: ArticleBlock[] }
export interface LegalContent {
  slug: "privacy" | "terms";
  title: string;
  /** ISO date, "2026-10-02". */
  lastUpdated: string;
  intro: string;
  sections: LegalSection[];
}

export interface PageManifestEntry {
  /** Starts with "/", no trailing slash. */
  path: string;
  /** Short title; the layout template appends " | Shuaib Health". */
  title: string;
  /** 50–160 characters. */
  description: string;
  kind: "static" | "doctor" | "department" | "lab-test" | "tip";
  inSitemap: boolean;
}

export interface ContactMessage { name: string; contact: string; subject: string; message: string }

// SiteConfig additions
export interface SiteConfig {
  // existing fields …
  labHours: OpeningHoursRule[];
  mapArea: { bbox: [west: number, south: number, east: number, north: number]; label: string };
}

// IconName additions (verified in the installed lucide-react)
export type IconName =
  // existing …
  | "droplet" | "candy" | "flame" | "bean" | "activity" | "sun" | "sparkles" | "test-tube"
  | "clipboard-check" | "flower" | "hourglass";
```

## Rules

1. No field stores a derived value (package sum and saving, reading time, available days, next available day).
2. No new content type contains HTML or markdown; text blocks are plain strings rendered by React.
3. Constraints in [data-model.md](../data-model.md) (counts, ranges, relationships) are enforced by tests, not by the types alone.
