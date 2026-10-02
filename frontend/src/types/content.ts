/**
 * Content shapes for the Shuaib Health demo site.
 *
 * These match what a future backend is expected to return
 * (specs/001-brand-home-page/contracts/content-shapes.md). They are not a
 * published API contract yet.
 */

export interface ImageAsset {
  /** Path under `public/`, for example "/images/departments/cardiology.jpg". */
  src: string;
  alt: string;
  width: number;
  height: number;
}

export interface Department {
  id: string;
  slug: string;
  name: string;
  /** One line, at most 90 characters. */
  summary: string;
  image: ImageAsset;
  sortOrder: number;
  /** Two or three sentences. */
  overview: string;
  /** A general list (five to eight items), not a diagnosis guide. */
  conditions: string[];
  services: string[];
  /** LabTest slugs, at least three. */
  relatedTestSlugs: string[];
  isSample: boolean;
}

export type Language = "Urdu" | "English" | "Sindhi" | "Punjabi";

export interface ScheduleSession {
  /** Never "sun": the sample clinic is closed on Sundays. */
  day: Exclude<Weekday, "sun">;
  /** 24-hour "HH:MM" in Asia/Karachi, within 09:00-21:00. */
  start: string;
  end: string;
}

export interface Doctor {
  id: string;
  slug: string;
  fullName: string;
  departmentId: string;
  specialty: string;
  photo: ImageAsset;
  /** Consultation fee in whole PKR. */
  feePkr: number;
  /** Generic degree titles only, for example ["MBBS", "FCPS (Medicine)"]. */
  qualifications: string[];
  /** Sample figure. */
  experienceYears: number;
  languages: Language[];
  bio: string;
  schedule: ScheduleSession[];
  isFeatured: boolean;
  isSample: boolean;
}

export interface HealthTip {
  id: string;
  slug: string;
  title: string;
  summary: string;
  category: string;
  /** ISO 8601 with the Karachi offset, for example "2026-09-12T09:00:00+05:00". */
  publishedAt: string;
  image: ImageAsset;
  isSample: boolean;
}

export type Weekday = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

export interface OpeningHoursRule {
  days: Weekday[];
  /** 24-hour "HH:MM". */
  opens: string;
  /** 24-hour "HH:MM", later than `opens`. */
  closes: string;
}

export interface PhoneNumber {
  display: string;
  /** E.164, used in tel: links. */
  tel: string;
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
  labHours: OpeningHoursRule[];
  mapArea: { bbox: [west: number, south: number, east: number, north: number]; label: string };
  credit: { text: string; href: string };
  /** When false, every page is sent with noindex. */
  indexable: boolean;
  isSample: boolean;
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
  /** Logistics only, for example "10-12 hours fasting". */
  preparation: string;
  homeCollection: boolean;
  /** One sentence on what the test is for. No interpretation or reference ranges. */
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

export interface PageManifestEntry {
  /** Starts with "/", no trailing slash. */
  path: string;
  /** Short title; the layout template appends " | Shuaib Health". */
  title: string;
  /** 50-160 characters. */
  description: string;
  kind: "static" | "doctor" | "department" | "lab-test" | "tip";
  inSitemap: boolean;
}

export interface NavItem {
  label: string;
  href: string;
}

/** Keys of the icon map in components/ui/icons.ts. Data files never import React components. */
export type IconName =
  | "activity"
  | "bean"
  | "calendar-check"
  | "candy"
  | "clipboard-check"
  | "clock"
  | "droplet"
  | "flame"
  | "flower"
  | "hourglass"
  | "sparkles"
  | "sun"
  | "test-tube"
  | "file-text"
  | "flask-conical"
  | "heart-pulse"
  | "house"
  | "map-pin"
  | "package"
  | "phone"
  | "receipt"
  | "siren"
  | "stethoscope";

/** Static home-page copy, not API-shaped. */

export interface HeroFact {
  id: string;
  label: string;
  iconName: IconName;
}

export interface QuickAction {
  id: string;
  label: string;
  description: string;
  href: string;
  iconName: IconName;
}

export interface Fact {
  id: string;
  value: string;
  label: string;
}

export interface WhyPoint {
  id: string;
  title: string;
  text: string;
  iconName: IconName;
}
