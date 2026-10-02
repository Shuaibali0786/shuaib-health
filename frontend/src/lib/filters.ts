import { availableDays } from "@/lib/schedule";
import type { Department, Doctor, HealthTip, LabTest, LabTestCategory, Weekday } from "@/types/content";

/**
 * Pure list filtering for the Doctors and Lab Tests pages, plus the query-string helpers that
 * keep filters in the URL (contracts/routes.md, rule 9). Unknown parameter values are ignored,
 * never an error. Search text is matched literally; it is never turned into a RegExp.
 */

/** Trim, collapse spaces, lowercase. */
function clean(text: string): string {
  return text.trim().replace(/\s+/g, " ").toLowerCase();
}

/**
 * Normalises a search box value. A leading "Dr" or "Dr." token is dropped only when other text
 * follows, so typing just "Dr." does not hide every doctor.
 */
export function normalizeQuery(text: string): string {
  const cleaned = clean(text);
  const withoutTitle = cleaned.replace(/^dr\.?(\s+|$)/, "");
  return withoutTitle.length > 0 ? withoutTitle : cleaned.replace(/^dr\.?$/, "");
}

export const FILTER_WEEKDAYS: Array<Exclude<Weekday, "sun">> = ["mon", "tue", "wed", "thu", "fri", "sat"];

export interface DoctorFilters {
  /** A department id, or "" for all. */
  departmentId: string;
  /** Raw search text. */
  query: string;
  /** A weekday, or "" for any. */
  day: Weekday | "";
}

export const NO_DOCTOR_FILTERS: DoctorFilters = { departmentId: "", query: "", day: "" };

export function hasDoctorFilters(filters: DoctorFilters): boolean {
  return filters.departmentId !== "" || normalizeQuery(filters.query) !== "" || filters.day !== "";
}

export function filterDoctors(doctors: Doctor[], filters: DoctorFilters): Doctor[] {
  const query = normalizeQuery(filters.query);
  return doctors.filter((doctor) => {
    if (filters.departmentId && doctor.departmentId !== filters.departmentId) return false;
    if (filters.day && !availableDays(doctor.schedule).includes(filters.day)) return false;
    if (query) {
      const name = clean(doctor.fullName).replace(/^dr\.?\s+/, "");
      if (!name.includes(query)) return false;
    }
    return true;
  });
}

export interface LabTestFilters {
  /** A category id, or "" for all. */
  categoryId: string;
  query: string;
}

export const NO_LAB_TEST_FILTERS: LabTestFilters = { categoryId: "", query: "" };

export function hasLabTestFilters(filters: LabTestFilters): boolean {
  return filters.categoryId !== "" || clean(filters.query) !== "";
}

export function filterLabTests(tests: LabTest[], filters: LabTestFilters): LabTest[] {
  const query = clean(filters.query);
  return tests.filter((test) => {
    if (filters.categoryId && test.categoryId !== filters.categoryId) return false;
    if (query) {
      const haystacks = [test.name, ...test.alsoKnownAs].map(clean);
      if (!haystacks.some((text) => text.includes(query))) return false;
    }
    return true;
  });
}

type ParamReader = (key: string) => string | null;

/** Reads `?department=<slug>&q=<text>&day=<mon..sat>`. Unknown values are ignored. */
export function parseDoctorFilters(get: ParamReader, departments: Pick<Department, "id" | "slug">[]): DoctorFilters {
  const department = departments.find((candidate) => candidate.slug === get("department"));
  const day = FILTER_WEEKDAYS.find((candidate) => candidate === get("day"));
  return { departmentId: department?.id ?? "", query: get("q") ?? "", day: day ?? "" };
}

/** The query string (without "?") for a set of doctor filters; empty when no filter is active. */
export function doctorFiltersToQuery(filters: DoctorFilters, departments: Pick<Department, "id" | "slug">[]): string {
  const params = new URLSearchParams();
  const department = departments.find((candidate) => candidate.id === filters.departmentId);
  if (department) params.set("department", department.slug);
  if (clean(filters.query)) params.set("q", filters.query.trim());
  if (filters.day) params.set("day", filters.day);
  return params.toString();
}

/** Reads `?category=<slug>&q=<text>`. Unknown values are ignored. */
export function parseLabTestFilters(get: ParamReader, categories: Pick<LabTestCategory, "id" | "slug">[]): LabTestFilters {
  const category = categories.find((candidate) => candidate.slug === get("category"));
  return { categoryId: category?.id ?? "", query: get("q") ?? "" };
}

export function labTestFiltersToQuery(filters: LabTestFilters, categories: Pick<LabTestCategory, "id" | "slug">[]): string {
  const params = new URLSearchParams();
  const category = categories.find((candidate) => candidate.id === filters.categoryId);
  if (category) params.set("category", category.slug);
  if (clean(filters.query)) params.set("q", filters.query.trim());
  return params.toString();
}

export interface TipFilters {
  /** A category name such as "Sleep", or "" for all. */
  category: string;
}

export const NO_TIP_FILTERS: TipFilters = { category: "" };

export function hasTipFilters(filters: TipFilters): boolean {
  return filters.category !== "";
}

export function filterTips(tips: HealthTip[], filters: TipFilters): HealthTip[] {
  return filters.category ? tips.filter((tip) => tip.category === filters.category) : tips;
}

/** "Mental wellbeing" becomes "mental-wellbeing", for the ?category= parameter. */
export function tipCategorySlug(category: string): string {
  return clean(category).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

/** Reads `?category=<slug>`. An unknown value is ignored. */
export function parseTipFilters(get: ParamReader, categories: string[]): TipFilters {
  const wanted = get("category");
  const category = categories.find((candidate) => tipCategorySlug(candidate) === wanted);
  return { category: category ?? "" };
}

export function tipFiltersToQuery(filters: TipFilters): string {
  const params = new URLSearchParams();
  if (filters.category) params.set("category", tipCategorySlug(filters.category));
  return params.toString();
}
