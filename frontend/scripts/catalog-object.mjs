// Builds the catalog object that seeds the backend (backend/app/seed/data/catalog.json).
// Shared by scripts/export-catalog.mjs and tests/unit/catalog-export.test.ts so the committed
// JSON can never drift from the mock data. The data files only use `import type`, so Node's
// built-in type stripping can load them directly.
import { departments } from "../tests/fixtures/catalog/departments.ts";
import { doctors } from "../tests/fixtures/catalog/doctors.ts";
import { healthPackages } from "../tests/fixtures/catalog/healthPackages.ts";
import { labTestCategories, labTests } from "../tests/fixtures/catalog/labTests.ts";
import { siteConfig } from "../tests/fixtures/catalog/siteConfig.ts";

export function buildCatalog() {
  return {
    siteConfig,
    departments,
    doctors,
    labTestCategories,
    labTests,
    healthPackages,
  };
}

export function serializeCatalog() {
  return `${JSON.stringify(buildCatalog(), null, 2)}\n`;
}
