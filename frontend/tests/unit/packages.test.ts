import { describe, expect, it, vi } from "vitest";
import { healthPackages } from "../fixtures/catalog/healthPackages";
import { labTests } from "../fixtures/catalog/labTests";
import { getHealthPackages, getPackagesIncludingTest } from "@/lib/content";
import { summarizePackage } from "@/lib/packages";
import { BANNED_CLAIMS, BRAND_WORDS, stringValues } from "./helpers/forbidden";

vi.mock("@/lib/api/cached", async () => (await import("./helpers/catalog-api-mock")).catalogApiMock);

const price = (slug: string) => labTests.find((test) => test.slug === slug)!.pricePkr;

describe("health packages (data-model invariant 4)", () => {
  it("has the five packages in order, with unique ids and slugs", () => {
    expect(healthPackages.map((pkg) => pkg.name)).toEqual([
      "Basic Health Check",
      "Diabetes Care",
      "Heart Check",
      "Women's Health",
      "Senior Citizen",
    ]);
    expect(new Set(healthPackages.map((pkg) => pkg.id)).size).toBe(5);
    expect(new Set(healthPackages.map((pkg) => pkg.slug)).size).toBe(5);
    for (const pkg of healthPackages) expect(pkg.isSample).toBe(true);
  });

  it.each(healthPackages.map((pkg) => [pkg.name, pkg] as const))("%s: the sum is the catalog sum and the package price is not higher", (_name, pkg) => {
    const summary = summarizePackage(pkg, labTests);
    const expected = pkg.testSlugs.reduce((total, slug) => total + price(slug), 0);
    expect(summary.sumPkr).toBe(expected);
    expect(Number.isInteger(pkg.packagePricePkr)).toBe(true);
    expect(pkg.packagePricePkr).toBeLessThanOrEqual(summary.sumPkr);
    expect(summary.savingPkr).toBe(summary.sumPkr - pkg.packagePricePkr);
    expect(summary.savingPkr).toBeGreaterThanOrEqual(0);
  });

  it("returns the tests in the package's own order", () => {
    for (const pkg of healthPackages) {
      expect(summarizePackage(pkg, labTests).tests.map((test) => test.slug)).toEqual(pkg.testSlugs);
    }
  });

  it("only names catalog tests, with no duplicates inside a package", () => {
    for (const pkg of healthPackages) {
      expect(new Set(pkg.testSlugs).size, pkg.slug).toBe(pkg.testSlugs.length);
      for (const slug of pkg.testSlugs) expect(labTests.some((test) => test.slug === slug), `${pkg.slug} -> ${slug}`).toBe(true);
    }
  });

  it("includes exactly the tests the task list names", () => {
    const bySlug = Object.fromEntries(healthPackages.map((pkg) => [pkg.slug, pkg.testSlugs.length]));
    expect(bySlug).toEqual({ "basic-health-check": 6, "diabetes-care": 6, "heart-check": 6, "womens-health": 6, "senior-citizen": 10 });
  });

  it("offers home collection only when every included test allows it", () => {
    for (const pkg of healthPackages) {
      const allAllow = pkg.testSlugs.every((slug) => labTests.find((test) => test.slug === slug)!.homeCollection);
      if (pkg.homeCollection) expect(allAllow, pkg.slug).toBe(true);
    }
  });

  it("states fasting in the preparation of every package that includes a fasting test", () => {
    for (const pkg of healthPackages) {
      const fasting = pkg.testSlugs.some((slug) => /fasting/i.test(labTests.find((test) => test.slug === slug)!.preparation));
      if (fasting) expect(pkg.preparation, pkg.slug).toMatch(/fasting/i);
      expect(pkg.preparation.trim().length).toBeGreaterThan(0);
    }
  });

  it("uses no percentages, promotional words, claims or brand names", () => {
    const text = stringValues(healthPackages);
    expect(text.filter((value) => /%|\b(save|saving|discount|offer|deal|best|cheap|free|bargain)\b/i.test(value))).toEqual([]);
    expect(text.filter((value) => BANNED_CLAIMS.test(value) || BRAND_WORDS.test(value))).toEqual([]);
  });
});

describe("summarizePackage", () => {
  it("throws when a package names a test that is not in the catalog", () => {
    const broken = { ...healthPackages[0]!, testSlugs: ["complete-blood-count", "no-such-test"] };
    expect(() => summarizePackage(broken, labTests)).toThrow(/no-such-test/);
  });
});

describe("package accessors", () => {
  it("returns the five packages", async () => {
    expect(await getHealthPackages()).toHaveLength(5);
  });

  it("finds the packages that include a test, and none for a test in no package", async () => {
    expect((await getPackagesIncludingTest("complete-blood-count")).map((pkg) => pkg.slug)).toEqual([
      "basic-health-check",
      "heart-check",
      "womens-health",
      "senior-citizen",
    ]);
    expect(await getPackagesIncludingTest("blood-group-rh")).toEqual([]);
    expect(await getPackagesIncludingTest("nope")).toEqual([]);
  });
});
