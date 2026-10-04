// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/http";
import { summarizePackage } from "@/lib/packages";
import { departments } from "../fixtures/catalog/departments";
import { doctors } from "../fixtures/catalog/doctors";
import { healthPackages } from "../fixtures/catalog/healthPackages";
import { labTestCategories, labTests } from "../fixtures/catalog/labTests";

const cached = vi.hoisted(() => ({
  cachedDepartments: vi.fn(),
  cachedDoctors: vi.fn(),
  cachedLabTestCategories: vi.fn(),
  cachedLabTests: vi.fn(),
  cachedHealthPackages: vi.fn(),
}));
vi.mock("@/lib/api/cached", () => cached);

import {
  getDepartmentBySlug,
  getDepartments,
  getDoctorBySlug,
  getDoctors,
  getDoctorsByDepartment,
  getFeaturedDoctors,
  getHealthPackages,
  getLabTestBySlug,
  getLabTests,
  getLabTestCategories,
  getLabTestsBySlugs,
  getPackagesIncludingTest,
  loadDepartments,
  loadDoctors,
  loadHealthPackages,
  loadLabTestCategories,
  loadLabTests,
} from "@/lib/content";

function serveFixtures() {
  cached.cachedDepartments.mockResolvedValue(departments);
  cached.cachedDoctors.mockResolvedValue(doctors);
  cached.cachedLabTestCategories.mockResolvedValue(labTestCategories);
  cached.cachedLabTests.mockResolvedValue(labTests);
  cached.cachedHealthPackages.mockResolvedValue(healthPackages);
}

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  serveFixtures();
});

describe("catalog accessors (data-model §6)", () => {
  it("lists departments by sort order, however the API ordered them", async () => {
    cached.cachedDepartments.mockResolvedValue([...departments].reverse());
    const result = await getDepartments();
    const expected = [...departments].sort((a, b) => a.sortOrder - b.sortOrder).map((department) => department.slug);
    expect(result.map((department) => department.slug)).toEqual(expected);
  });

  it("finds a department, a doctor and a lab test by slug", async () => {
    expect((await getDepartmentBySlug(departments[1]!.slug))?.id).toBe(departments[1]!.id);
    expect((await getDoctorBySlug(doctors[0]!.slug))?.id).toBe(doctors[0]!.id);
    expect((await getLabTestBySlug(labTests[0]!.slug))?.id).toBe(labTests[0]!.id);
    expect(await getDoctorBySlug("nobody")).toBeUndefined();
  });

  it("returns doctors, categories, tests and packages in API order", async () => {
    expect((await getDoctors()).map((doctor) => doctor.id)).toEqual(doctors.map((doctor) => doctor.id));
    expect((await getLabTestCategories()).map((category) => category.id)).toEqual(labTestCategories.map((category) => category.id));
    expect((await getLabTests()).map((test) => test.id)).toEqual(labTests.map((test) => test.id));
    expect((await getHealthPackages()).map((pkg) => pkg.id)).toEqual(healthPackages.map((pkg) => pkg.id));
  });

  it("clamps the featured doctors to 3–4 and keeps only featured ones", async () => {
    const featured = await getFeaturedDoctors(10);
    expect(featured.length).toBeGreaterThanOrEqual(3);
    expect(featured.length).toBeLessThanOrEqual(4);
    expect(featured.every((doctor) => doctor.isFeatured)).toBe(true);
    expect((await getFeaturedDoctors(1)).length).toBe(3);
  });

  it("picks lab tests by slug in the order given and skips unknown slugs", async () => {
    const [a, b] = [labTests[3]!, labTests[1]!];
    const picked = await getLabTestsBySlugs([a.slug, "no-such-test", b.slug]);
    expect(picked.map((test) => test.slug)).toEqual([a.slug, b.slug]);
  });

  it("finds the packages that include a test", async () => {
    const pkg = healthPackages[0]!;
    const slug = pkg.testSlugs[0]!;
    const found = await getPackagesIncludingTest(slug);
    expect(found.map((candidate) => candidate.id)).toContain(pkg.id);
    expect(found.every((candidate) => candidate.testSlugs.includes(slug))).toBe(true);
    expect(await getPackagesIncludingTest("no-such-test")).toEqual([]);
  });
});

describe("unavailable catalog", () => {
  it.each([
    ["loadDepartments", "cachedDepartments", loadDepartments],
    ["loadDoctors", "cachedDoctors", loadDoctors],
    ["loadLabTestCategories", "cachedLabTestCategories", loadLabTestCategories],
    ["loadLabTests", "cachedLabTests", loadLabTests],
    ["loadHealthPackages", "cachedHealthPackages", loadHealthPackages],
  ] as const)("%s returns ok:false when the cached loader throws", async (_name, loader, run) => {
    cached[loader].mockRejectedValue(new ApiError("timeout"));
    expect(await run()).toEqual({ ok: false, reason: "unavailable" });
  });

  it("reports an unset API URL as unconfigured", async () => {
    cached.cachedDoctors.mockRejectedValue(new ApiError("unconfigured"));
    expect(await loadDoctors()).toEqual({ ok: false, reason: "unconfigured" });
  });

  it("makes the get helpers return empty or undefined instead of throwing", async () => {
    for (const loader of Object.values(cached)) loader.mockRejectedValue(new ApiError("network"));
    expect(await getDepartments()).toEqual([]);
    expect(await getDoctors()).toEqual([]);
    expect(await getFeaturedDoctors()).toEqual([]);
    expect(await getLabTests()).toEqual([]);
    expect(await getLabTestCategories()).toEqual([]);
    expect(await getHealthPackages()).toEqual([]);
    expect(await getDepartmentBySlug("cardiology")).toBeUndefined();
    expect(await getDoctorBySlug("dr-anyone")).toBeUndefined();
    expect(await getLabTestBySlug("esr")).toBeUndefined();
    expect(await getLabTestsBySlugs(["esr"])).toEqual([]);
    expect(await getPackagesIncludingTest("esr")).toEqual([]);
    expect(await getDoctorsByDepartment("any")).toEqual([]);
  });
});

describe("dangling references (spec edge case)", () => {
  it("still lists a doctor whose department is not in the list", async () => {
    const orphan = { ...doctors[0]!, id: "orphan", slug: "dr-orphan", departmentId: "no-such-department" };
    cached.cachedDoctors.mockResolvedValue([...doctors, orphan]);
    expect((await getDoctors()).map((doctor) => doctor.slug)).toContain("dr-orphan");
    expect(await getDoctorsByDepartment("no-such-department")).toEqual([expect.objectContaining({ slug: "dr-orphan" })]);
    expect((await getDoctorsByDepartment(departments[0]!.id)).map((doctor) => doctor.slug)).not.toContain("dr-orphan");
    const department = (await getDepartments()).find((candidate) => candidate.id === orphan.departmentId);
    expect(department).toBeUndefined();
  });

  it("shows the other tests of a package that names a missing test, with no empty entry", async () => {
    const pkg = healthPackages[0]!;
    const broken = { ...pkg, testSlugs: [...pkg.testSlugs, "no-such-test"] };
    const summary = summarizePackage(broken, await getLabTests(), { skipMissing: true });
    expect(summary.tests.map((test) => test.slug)).toEqual(pkg.testSlugs);
    expect(summary.tests.every(Boolean)).toBe(true);
  });
});
