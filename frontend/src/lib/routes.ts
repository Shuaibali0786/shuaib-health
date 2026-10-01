import { departments } from "@/data/departments";
import { doctors } from "@/data/doctors";
import { healthTips } from "@/data/healthTips";

/**
 * Route registry (specs/001-brand-home-page/contracts/routes.md).
 * "/" is the only real page in Feature 001. Every other path below is served
 * by app/[...slug]/page.tsx as a "Coming soon" page. When a later feature adds
 * a real page for a path, remove that path from `STATIC_PLACEHOLDERS` in the
 * same change.
 */

export const ROUTES = {
  home: "/",
  about: "/about",
  doctors: "/doctors",
  departments: "/departments",
  labTests: "/lab-tests",
  healthPackages: "/health-packages",
  healthTips: "/health-tips",
  contact: "/contact",
  bookAppointment: "/book-appointment",
  homeSampleCollection: "/home-sample-collection",
  privacy: "/privacy",
  terms: "/terms",
} as const;

export const doctorPath = (slug: string): string => `${ROUTES.doctors}/${slug}`;
export const departmentPath = (slug: string): string => `${ROUTES.departments}/${slug}`;
export const tipPath = (slug: string): string => `${ROUTES.healthTips}/${slug}`;

export type PlaceholderKind = "static" | "doctor" | "department" | "tip";

export interface PlaceholderRoute {
  /** Starts with "/", no trailing slash. */
  path: string;
  /** Shown on the Coming soon page and in metadata. */
  title: string;
  kind: PlaceholderKind;
}

const STATIC_PLACEHOLDERS: PlaceholderRoute[] = [
  { path: ROUTES.about, title: "About", kind: "static" },
  { path: ROUTES.doctors, title: "Doctors", kind: "static" },
  { path: ROUTES.departments, title: "Departments", kind: "static" },
  { path: ROUTES.labTests, title: "Lab Tests", kind: "static" },
  { path: ROUTES.healthPackages, title: "Health Packages", kind: "static" },
  { path: ROUTES.healthTips, title: "Health Tips", kind: "static" },
  { path: ROUTES.contact, title: "Contact", kind: "static" },
  { path: ROUTES.bookAppointment, title: "Book Appointment", kind: "static" },
  { path: ROUTES.homeSampleCollection, title: "Home Sample Collection", kind: "static" },
  { path: ROUTES.privacy, title: "Privacy", kind: "static" },
  { path: ROUTES.terms, title: "Terms", kind: "static" },
];

/** Every path served as "Coming soon": the fixed paths plus one per doctor, department and tip. */
export function placeholderRoutes(): PlaceholderRoute[] {
  return [
    ...STATIC_PLACEHOLDERS,
    ...doctors.map((doctor): PlaceholderRoute => ({
      path: doctorPath(doctor.slug),
      title: doctor.fullName,
      kind: "doctor",
    })),
    ...departments.map((department): PlaceholderRoute => ({
      path: departmentPath(department.slug),
      title: department.name,
      kind: "department",
    })),
    ...healthTips.map((tip): PlaceholderRoute => ({
      path: tipPath(tip.slug),
      title: tip.title,
      kind: "tip",
    })),
  ];
}

/**
 * Whether a navigation link is the current page. Home matches only "/";
 * every other link also matches its sub-paths (/doctors matches /doctors/dr-x).
 */
export function isActivePath(pathname: string, href: string): boolean {
  if (href === ROUTES.home) return pathname === ROUTES.home;
  return pathname === href || pathname.startsWith(`${href}/`);
}

function normalize(path: string): string {
  return path.length > 1 ? path.replace(/\/+$/, "") : path;
}

/** The Coming soon entry for a path, or undefined if the path is not registered. */
export function findPlaceholderRoute(path: string): PlaceholderRoute | undefined {
  const target = normalize(path);
  return placeholderRoutes().find((route) => route.path === target);
}

/** True for the Home page and for every registered Coming soon path. */
export function isKnownPath(path: string): boolean {
  return normalize(path) === ROUTES.home || findPlaceholderRoute(path) !== undefined;
}
