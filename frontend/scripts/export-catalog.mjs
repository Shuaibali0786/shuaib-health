// Writes the frontend mock catalog to backend/app/seed/data/catalog.json.
// Run from frontend/: node scripts/export-catalog.mjs
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { buildCatalog, serializeCatalog } from "./catalog-object.mjs";

const target = fileURLToPath(new URL("../../backend/app/seed/data/catalog.json", import.meta.url));
writeFileSync(target, serializeCatalog(), "utf8");

const catalog = buildCatalog();
console.log(
  `Wrote catalog.json: ${catalog.departments.length} departments, ${catalog.doctors.length} doctors, ` +
    `${catalog.labTestCategories.length} categories, ${catalog.labTests.length} lab tests, ` +
    `${catalog.healthPackages.length} packages`,
);
