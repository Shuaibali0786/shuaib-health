import type { HealthPackage, LabTest } from "@/types/content";

export interface PackageSummary {
  /** The catalog tests in the package, in the package's order. */
  tests: LabTest[];
  /** What the tests cost one by one, from the catalog. */
  sumPkr: number;
  /** `sumPkr` minus the package price. */
  savingPkr: number;
}

/**
 * Works out a package's totals from the catalog, so a displayed sum can never differ from the
 * prices on the test pages. Throws if a package names a test that is not in the catalog: a broken
 * link must fail a check, never reach a visitor.
 */
export function summarizePackage(pkg: HealthPackage, catalog: LabTest[]): PackageSummary {
  const tests = pkg.testSlugs.map((slug) => {
    const test = catalog.find((candidate) => candidate.slug === slug);
    if (!test) throw new Error(`Package "${pkg.slug}" includes unknown lab test "${slug}"`);
    return test;
  });
  const sumPkr = tests.reduce((total, test) => total + test.pricePkr, 0);
  return { tests, sumPkr, savingPkr: sumPkr - pkg.packagePricePkr };
}
