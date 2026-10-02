import { departments } from "@/data/departments";
import { healthTips } from "@/data/healthTips";
import { doctors } from "@/data/doctors";
import { labTests } from "@/data/labTests";

/**
 * Route registry (specs/001-brand-home-page/contracts/routes.md and
 * specs/002-public-pages/contracts/routes.md).
 *
 * Pages that exist are listed in `realPaths()`. Pages that do not exist yet are still served
 * by app/[...slug]/page.tsx as "Coming soon" and are listed in `placeholderRoutes()`. When a
 * feature adds a real page for a path, remove that path from `STATIC_PLACEHOLDERS` (or drop its
 * kind below) in the same change. Feature 002 removes the last placeholders and the catch-all.
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
  faq: "/faq",
  bookAppointment: "/book-appointment",
  privacy: "/privacy",
  terms: "/terms",
} as const;

export const doctorPath = (slug: string): string => `${ROUTES.doctors}/${slug}`;
export const departmentPath = (slug: string): string => `${ROUTES.departments}/${slug}`;
export const labTestPath = (slug: string): string => `${ROUTES.labTests}/${slug}`;
export const tipPath = (slug: string): string => `${ROUTES.healthTips}/${slug}`;

export type PlaceholderKind = "static" | "lab-test" | "tip";

export interface PlaceholderRoute {
  /** Starts with "/", no trailing slash. */
  path: string;
  /** Shown on the Coming soon page and in metadata. */
  title: string;
  kind: PlaceholderKind;
}

const STATIC_PLACEHOLDERS: PlaceholderRoute[] = [
  { path: ROUTES.about, title: "About", kind: "static" },
  { path: ROUTES.labTests, title: "Lab Tests", kind: "static" },
  { path: ROUTES.healthPackages, title: "Health Packages", kind: "static" },
  { path: ROUTES.healthTips, title: "Health Tips", kind: "static" },
  { path: ROUTES.contact, title: "Contact", kind: "static" },
  { path: ROUTES.faq, title: "FAQ", kind: "static" },
  { path: ROUTES.privacy, title: "Privacy", kind: "static" },
  { path: ROUTES.terms, title: "Terms", kind: "static" },
];

/** Every path served as "Coming soon": the fixed paths plus one per lab test and tip. */
export function placeholderRoutes(): PlaceholderRoute[] {
  return [
    ...STATIC_PLACEHOLDERS,
    ...labTests.map((test): PlaceholderRoute => ({
      path: labTestPath(test.slug),
      title: test.name,
      kind: "lab-test",
    })),
    ...healthTips.map((tip): PlaceholderRoute => ({
      path: tipPath(tip.slug),
      title: tip.title,
      kind: "tip",
    })),
  ];
}

/** Paths that have a real page: Home, the booking holding page, and the Doctors and Departments pages. */
export function realPaths(): string[] {
  return [
    ROUTES.home,
    ROUTES.bookAppointment,
    ROUTES.doctors,
    ...doctors.map((doctor) => doctorPath(doctor.slug)),
    ROUTES.departments,
    ...departments.map((department) => departmentPath(department.slug)),
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
  // Ignore a #fragment or ?query, so "/faq#home-sample-collection" is the page "/faq".
  const bare = path.split("#")[0]?.split("?")[0] ?? path;
  return bare.length > 1 ? bare.replace(/\/+$/, "") : bare;
}

/** The Coming soon entry for a path, or undefined if the path is not registered. */
export function findPlaceholderRoute(path: string): PlaceholderRoute | undefined {
  const target = normalize(path);
  return placeholderRoutes().find((route) => route.path === target);
}

/** True for every real page and every registered Coming soon path. */
export function isKnownPath(path: string): boolean {
  const target = normalize(path);
  return realPaths().includes(target) || findPlaceholderRoute(target) !== undefined;
}
