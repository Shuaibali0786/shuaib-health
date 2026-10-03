// Builds the catalog object that seeds the backend (backend/app/seed/data/catalog.json).
// Shared by scripts/export-catalog.mjs and tests/unit/catalog-export.test.ts so the committed
// JSON can never drift from the mock data. The data files only use `import type`, so Node's
// built-in type stripping can load them directly.
import { departments } from "../src/data/departments.ts";
import { doctors } from "../src/data/doctors.ts";
import { healthPackages } from "../src/data/healthPackages.ts";
import { labTestCategories, labTests } from "../src/data/labTests.ts";
import { siteConfig } from "../src/data/siteConfig.ts";

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
