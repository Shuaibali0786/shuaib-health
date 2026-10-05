/**
 * Route constants and slug builders. Every public page is listed in the page manifest
 * (lib/pages.ts), which is the one source for "which paths exist" (`knownPaths`, `isKnownPath`).
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

/** The booking page, optionally opened with a doctor or a department already chosen (FR-071). */
export function bookingPath(params: { doctor?: string; department?: string } = {}): string {
  const query = (["department", "doctor"] as const).flatMap((key) => {
    const value = params[key];
    return value ? [`${key}=${encodeURIComponent(value)}`] : [];
  });
  return query.length > 0 ? `${ROUTES.bookAppointment}?${query.join("&")}` : ROUTES.bookAppointment;
}

export const doctorPath = (slug: string): string => `${ROUTES.doctors}/${slug}`;
export const departmentPath = (slug: string): string => `${ROUTES.departments}/${slug}`;
export const labTestPath = (slug: string): string => `${ROUTES.labTests}/${slug}`;
export const tipPath = (slug: string): string => `${ROUTES.healthTips}/${slug}`;

/**
 * Whether a navigation link is the current page. Home matches only "/";
 * every other link also matches its sub-paths (/doctors matches /doctors/dr-x).
 */
export function isActivePath(pathname: string, href: string): boolean {
  if (href === ROUTES.home) return pathname === ROUTES.home;
  return pathname === href || pathname.startsWith(`${href}/`);
}
