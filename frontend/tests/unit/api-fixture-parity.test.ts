import { describe, expect, it } from "vitest";

import { departments } from "../fixtures/catalog/departments";
import { doctors } from "../fixtures/catalog/doctors";
import { healthPackages } from "../fixtures/catalog/healthPackages";
import { labTestCategories, labTests } from "../fixtures/catalog/labTests";
import { siteConfig } from "../fixtures/catalog/siteConfig";
import { readApiFixture } from "./helpers/api-contract";

/**
 * The recorded API responses must carry the same content as the TypeScript catalog fixtures the
 * backend was seeded from. Compared field by field, matched by slug. IDs are random per database,
 * so references are compared by the slug they resolve to. Fields the API adds (slotMinutes, logo,
 * brandColors) are ignored.
 */
type Row = Record<string, unknown> & { id: string; slug: string };
const items = (name: Parameters<typeof readApiFixture>[0]) => (readApiFixture(name) as { items: Row[] }).items;

function slugOf(rows: Array<{ id: string; slug: string }>) {
  return new Map(rows.map((r) => [r.id, r.slug]));
}

function bySlug<T extends { slug: string }>(rows: T[]): Map<string, T> {
  return new Map(rows.map((r) => [r.slug, r]));
}

function without<T extends object>(row: T, keys: string[]) {
  const copy: Record<string, unknown> = { ...(row as Record<string, unknown>) };
  for (const key of keys) delete copy[key];
  return copy;
}

function expectSameSlugs(api: Row[], local: Array<{ slug: string }>) {
  expect(api.map((r) => r.slug).sort()).toEqual(local.map((r) => r.slug).sort());
}

const apiDepartments = items("departments");
const apiCategories = items("lab-test-categories");
const deptSlugApi = slugOf(apiDepartments);
const deptSlugLocal = slugOf(departments);
const catSlugApi = slugOf(apiCategories);
const catSlugLocal = slugOf(labTestCategories);

describe("recorded API fixtures match the TS catalog fixtures", () => {
  it("departments", () => {
    expectSameSlugs(apiDepartments, departments);
    const local = bySlug(departments);
    for (const api of apiDepartments) {
      expect(without(api, ["id"]), api.slug).toEqual(without(local.get(api.slug)!, ["id"]));
    }
  });

  it("doctors", () => {
    const api = items("doctors");
    expectSameSlugs(api, doctors);
    const local = bySlug(doctors);
    for (const row of api) {
      const expected = local.get(row.slug)!;
      const schedule = (row.schedule as Array<Record<string, unknown>>).map((s) => without(s, ["slotMinutes"]));
      expect(
        { ...without(row, ["id", "departmentId", "schedule"]), dept: deptSlugApi.get(row.departmentId as string), schedule },
        row.slug,
      ).toEqual({
        ...without(expected, ["id", "departmentId", "schedule"]),
        dept: deptSlugLocal.get(expected.departmentId),
        schedule: expected.schedule,
      });
    }
  });

  it("lab test categories", () => {
    expectSameSlugs(apiCategories, labTestCategories);
    const local = bySlug(labTestCategories);
    for (const row of apiCategories) {
      expect(without(row, ["id"]), row.slug).toEqual(without(local.get(row.slug)!, ["id"]));
    }
  });

  it("lab tests", () => {
    const api = items("lab-tests");
    expectSameSlugs(api, labTests);
    const local = bySlug(labTests);
    const resolve = (ids: string[], map: Map<string, string>) => ids.map((id) => map.get(id)).sort();
    for (const row of api) {
      const expected = local.get(row.slug)!;
      expect(
        {
          ...without(row, ["id", "categoryId", "relatedDepartmentIds"]),
          category: catSlugApi.get(row.categoryId as string),
          related: resolve(row.relatedDepartmentIds as string[], deptSlugApi),
        },
        row.slug,
      ).toEqual({
        ...without(expected, ["id", "categoryId", "relatedDepartmentIds"]),
        category: catSlugLocal.get(expected.categoryId),
        related: resolve(expected.relatedDepartmentIds, deptSlugLocal),
      });
    }
  });

  it("health packages", () => {
    const api = items("health-packages");
    expectSameSlugs(api, healthPackages);
    const local = bySlug(healthPackages);
    for (const row of api) {
      expect(without(row, ["id"]), row.slug).toEqual(without(local.get(row.slug)!, ["id"]));
    }
  });

  it("clinic settings", () => {
    const api = readApiFixture("clinic") as Record<string, unknown>;
    expect(without(api, ["logo", "brandColors"])).toEqual(siteConfig);
  });
});
