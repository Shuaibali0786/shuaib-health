/**
 * Content shapes for the Shuaib Health demo site.
 *
 * These match what a future backend is expected to return
 * (specs/001-brand-home-page/contracts/content-shapes.md). They are not a
 * published API contract yet.
 */

export interface ImageAsset {
  /** Path under `public/`, for example "/images/departments/cardiology-placeholder.jpg". */
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
  isSample: boolean;
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
  credit: { text: string; href: string };
  /** When false, every page is sent with noindex. */
  indexable: boolean;
  isSample: boolean;
}

export interface NavItem {
  label: string;
  href: string;
}

/** Keys of the icon map in components/ui/icons.ts. Data files never import React components. */
export type IconName =
  | "calendar-check"
  | "clock"
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
