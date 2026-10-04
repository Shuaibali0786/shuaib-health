import { cache } from "react";
import { aboutContent } from "@/data/aboutContent";
import { faqGroups } from "@/data/faq";
import { legalContent } from "@/data/legalContent";
import { healthTips } from "@/data/healthTips";
import { siteConfig } from "@/data/siteConfig";
import {
  cachedClinic,
  cachedDepartments,
  cachedDoctors,
  cachedHealthPackages,
  cachedLabTestCategories,
  cachedLabTests,
} from "@/lib/api/cached";
import { getClinicFallback } from "@/lib/api/config";
import { load, type Loaded } from "@/lib/api/load";
import type { ClinicSettings } from "@/lib/api/schemas";
import { toIconName } from "@/components/ui/icons";
import type { AboutContent, LegalContent, Department, FaqGroup, Doctor, HealthPackage, HealthTip, LabTest, LabTestCategory, SiteConfig } from "@/types/content";

/**
 * The only place components read content from. Every accessor is async. The catalog (departments,
 * doctors, lab tests, packages) comes from the catalog API through the cached loaders in
 * `@/lib/api/cached` (ADR-0004). Each `load*` function returns `Loaded<T>` so a page can show a
 * friendly message for one section when the data never loaded; the `get*` helpers return empty or
 * `undefined` in that case, for code that only needs data-or-nothing (sitemap, static params).
 * Editorial content (tips, about, FAQ, legal) still lives in `src/data`.
 */

export type { Loaded };

function toSiteConfig(clinic: ClinicSettings): SiteConfig {
  // The generated type has a plain number[] for the four-number bounding box.
  const [west = 0, south = 0, east = 0, north = 0] = clinic.mapArea.bbox;
  return { ...clinic, mapArea: { bbox: [west, south, east, north], label: clinic.mapArea.label } };
}

/**
 * Clinic identity, in this order (FR-022): the live or last-good API value, else the validated
 * `CLINIC_FALLBACK_JSON`, else the bundled sample. The emergency number is therefore always
 * available, whatever state the API is in. (The last step becomes a neutral identity in the
 * identity-from-data phase.)
 */
export async function getSiteConfig(): Promise<SiteConfig> {
  const clinic = await clinicLoaded();
  if (clinic.ok) return toSiteConfig(clinic.data);
  const fallback = getClinicFallback();
  return fallback ? toSiteConfig(fallback) : siteConfig;
}

const bySortOrder = <T extends { sortOrder: number }>(a: T, b: T) => a.sortOrder - b.sortOrder;

// React's cache() shares one result per render, so a page that calls several accessors for the
// same resource asks the data cache (and logs a failure) once.
const clinicLoaded = cache(() => load("clinic", cachedClinic));
const departmentsLoaded = cache(() => load("departments", cachedDepartments));
const doctorsLoaded = cache(() => load("doctors", cachedDoctors));
const categoriesLoaded = cache(() => load("lab-test-categories", cachedLabTestCategories));
const labTestsLoaded = cache(() => load("lab-tests", cachedLabTests));
const packagesLoaded = cache(() => load("health-packages", cachedHealthPackages));

function mapLoaded<T, U>(result: Loaded<T>, map: (data: T) => U): Loaded<U> {
  return result.ok ? { ok: true, data: map(result.data) } : result;
}

/** Departments in display order. */
export async function loadDepartments(): Promise<Loaded<Department[]>> {
  return mapLoaded(await departmentsLoaded(), (list) => [...list].sort(bySortOrder));
}

/** All doctors, in API order. */
export async function loadDoctors(): Promise<Loaded<Doctor[]>> {
  return mapLoaded(await doctorsLoaded(), (list) => [...list]);
}

/** The lab test categories, in API order. */
export async function loadLabTestCategories(): Promise<Loaded<LabTestCategory[]>> {
  // The API sends the icon as a plain string; an unknown one falls back to a generic icon.
  return mapLoaded(await categoriesLoaded(), (list) =>
    list.map((category) => ({ ...category, iconName: toIconName(category.iconName, "test-tube") })),
  );
}

/** All lab tests, in API order. */
export async function loadLabTests(): Promise<Loaded<LabTest[]>> {
  return mapLoaded(await labTestsLoaded(), (list) => [...list]);
}

/** The health packages, in API order. */
export async function loadHealthPackages(): Promise<Loaded<HealthPackage[]>> {
  return mapLoaded(await packagesLoaded(), (list) => list.map((pkg) => ({ ...pkg, iconName: toIconName(pkg.iconName, "package") })));
}

const orEmpty = <T>(result: Loaded<T[]>): T[] => (result.ok ? result.data : []);

/** Departments in display order. Empty when the catalog is unavailable. */
export async function getDepartments(): Promise<Department[]> {
  return orEmpty(await loadDepartments());
}

export async function getDepartmentBySlug(slug: string): Promise<Department | undefined> {
  return (await getDepartments()).find((department) => department.slug === slug);
}

/** Featured doctors only, in data order. The limit is clamped to 3–4 (FR-016). */
export async function loadFeaturedDoctors(limit = 4): Promise<Loaded<Doctor[]>> {
  const clamped = Math.min(4, Math.max(3, Math.trunc(limit)));
  return mapLoaded(await loadDoctors(), (list) => list.filter((doctor) => doctor.isFeatured).slice(0, clamped));
}

export async function getFeaturedDoctors(limit = 4): Promise<Doctor[]> {
  return orEmpty(await loadFeaturedDoctors(limit));
}

export async function getDoctorBySlug(slug: string): Promise<Doctor | undefined> {
  return (await getDoctors()).find((doctor) => doctor.slug === slug);
}

/** Newest first by `publishedAt`; ties break by id. */
export async function getLatestHealthTips(limit = 3): Promise<HealthTip[]> {
  return [...healthTips]
    .sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt) || a.id.localeCompare(b.id))
    .slice(0, Math.max(0, Math.trunc(limit)));
}

export async function getHealthTipBySlug(slug: string): Promise<HealthTip | undefined> {
  return healthTips.find((tip) => tip.slug === slug);
}

/** All doctors, in API order. Empty when the catalog is unavailable. */
export async function getDoctors(): Promise<Doctor[]> {
  return orEmpty(await loadDoctors());
}

export async function getDoctorsByDepartment(departmentId: string): Promise<Doctor[]> {
  return (await getDoctors()).filter((doctor) => doctor.departmentId === departmentId);
}

/** The lab test categories, in API order. */
export async function getLabTestCategories(): Promise<LabTestCategory[]> {
  return orEmpty(await loadLabTestCategories());
}

/** All lab tests, in API order. */
export async function getLabTests(): Promise<LabTest[]> {
  return orEmpty(await loadLabTests());
}

export async function getLabTestBySlug(slug: string): Promise<LabTest | undefined> {
  return (await getLabTests()).find((test) => test.slug === slug);
}

/** The tests for the given slugs, in the order given. Unknown slugs are skipped. */
export async function getLabTestsBySlugs(slugs: string[]): Promise<LabTest[]> {
  const tests = await getLabTests();
  return slugs.flatMap((slug) => tests.filter((test) => test.slug === slug));
}

/** The health packages, in API order. */
export async function getHealthPackages(): Promise<HealthPackage[]> {
  return orEmpty(await loadHealthPackages());
}

/** Packages that include the given lab test, in display order. Empty when none does. */
export async function getPackagesIncludingTest(slug: string): Promise<HealthPackage[]> {
  return (await getHealthPackages()).filter((pkg) => pkg.testSlugs.includes(slug));
}

/** All health tips, newest first; ties break by id. */
export async function getHealthTips(): Promise<HealthTip[]> {
  return getLatestHealthTips(healthTips.length);
}

/** The distinct tip categories, in the order they first appear among the newest-first tips. */
export async function getHealthTipCategories(): Promise<string[]> {
  return [...new Set((await getHealthTips()).map((tip) => tip.category))];
}

/**
 * Other articles to read next: same category first, then the rest, each group newest first.
 * Never includes the article itself.
 */
export async function getRelatedTips(slug: string, limit = 3): Promise<HealthTip[]> {
  const current = healthTips.find((tip) => tip.slug === slug);
  const others = (await getHealthTips()).filter((tip) => tip.slug !== slug);
  const sameCategory = others.filter((tip) => current && tip.category === current.category);
  const rest = others.filter((tip) => !sameCategory.includes(tip));
  return [...sameCategory, ...rest].slice(0, Math.max(0, Math.trunc(limit)));
}

/** The About page content. */
export async function getAboutContent(): Promise<AboutContent> {
  return aboutContent;
}

/** The five FAQ groups, in display order. */
export async function getFaqGroups(): Promise<FaqGroup[]> {
  return faqGroups;
}

/** The Privacy or Terms page content. */
export async function getLegalContent(slug: LegalContent["slug"]): Promise<LegalContent> {
  return legalContent[slug];
}
