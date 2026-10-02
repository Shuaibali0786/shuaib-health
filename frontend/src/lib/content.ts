import { departments } from "@/data/departments";
import { doctors } from "@/data/doctors";
import { healthTips } from "@/data/healthTips";
import { labTestCategories, labTests } from "@/data/labTests";
import { siteConfig } from "@/data/siteConfig";
import type { Department, Doctor, HealthTip, LabTest, LabTestCategory, SiteConfig } from "@/types/content";

/**
 * The only place components read content from. Every accessor is async so a
 * future backend can replace the sample data without touching components.
 * Phase 2 will fetch from the API here and fall back to the sample data when
 * the backend is unreachable, so the build never fails (constitution V).
 */

export async function getSiteConfig(): Promise<SiteConfig> {
  return siteConfig;
}

/** Departments in display order. */
export async function getDepartments(): Promise<Department[]> {
  return [...departments].sort((a, b) => a.sortOrder - b.sortOrder);
}

export async function getDepartmentBySlug(slug: string): Promise<Department | undefined> {
  return departments.find((department) => department.slug === slug);
}

/** Featured doctors only, in data order. The limit is clamped to 3–4 (FR-016). */
export async function getFeaturedDoctors(limit = 4): Promise<Doctor[]> {
  const clamped = Math.min(4, Math.max(3, Math.trunc(limit)));
  return doctors.filter((doctor) => doctor.isFeatured).slice(0, clamped);
}

export async function getDoctorBySlug(slug: string): Promise<Doctor | undefined> {
  return doctors.find((doctor) => doctor.slug === slug);
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

/** All doctors, in data order. */
export async function getDoctors(): Promise<Doctor[]> {
  return [...doctors];
}

export async function getDoctorsByDepartment(departmentId: string): Promise<Doctor[]> {
  return doctors.filter((doctor) => doctor.departmentId === departmentId);
}

/** The nine catalog categories, in display order. */
export async function getLabTestCategories(): Promise<LabTestCategory[]> {
  return [...labTestCategories];
}

/** All lab tests, in catalog order. */
export async function getLabTests(): Promise<LabTest[]> {
  return [...labTests];
}

export async function getLabTestBySlug(slug: string): Promise<LabTest | undefined> {
  return labTests.find((test) => test.slug === slug);
}

/** The tests for the given slugs, in the order given. Unknown slugs are skipped. */
export async function getLabTestsBySlugs(slugs: string[]): Promise<LabTest[]> {
  return slugs.flatMap((slug) => labTests.filter((test) => test.slug === slug));
}
