import "server-only";

import { unstable_cache } from "next/cache";

import { getDataRevalidateSeconds } from "./config";
import { getJson } from "./http";
import { getAllPages } from "./paginate";
import {
  ClinicRuleSchema,
  ClinicSettingsSchema,
  DepartmentSchema,
  DoctorSchema,
  HealthPackageSchema,
  LabTestCategorySchema,
  LabTestSchema,
} from "./schemas";

/** Documentation only: route segments must write the literal `300` because Next requires it to be static. */
export const CATALOG_REVALIDATE = 300;

// One Next data-cache entry per resource. When a refresh throws, Next keeps serving the last good
// value, and when nothing was ever cached the error propagates to `load()` (ADR-0004).
function cachedResource<T>(key: string, fn: () => Promise<T>): () => Promise<T> {
  return unstable_cache(fn, ["api", key], { revalidate: getDataRevalidateSeconds(), tags: ["catalog", key] });
}

export const cachedClinic = cachedResource("clinic", () => getJson("/clinic", ClinicSettingsSchema));
export const cachedClinicRules = cachedResource("clinic-rules", () => getAllPages("/clinic/rules", ClinicRuleSchema));
export const cachedDepartments = cachedResource("departments", () => getAllPages("/departments", DepartmentSchema));
export const cachedDoctors = cachedResource("doctors", () => getAllPages("/doctors", DoctorSchema));
export const cachedLabTestCategories = cachedResource("lab-test-categories", () =>
  getAllPages("/lab-test-categories", LabTestCategorySchema),
);
export const cachedLabTests = cachedResource("lab-tests", () => getAllPages("/lab-tests", LabTestSchema));
export const cachedHealthPackages = cachedResource("health-packages", () =>
  getAllPages("/health-packages", HealthPackageSchema),
);
