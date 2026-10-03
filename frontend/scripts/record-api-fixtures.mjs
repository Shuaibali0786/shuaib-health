// Records the catalog API responses into tests/fixtures/api/*.json (used by the mock API and contract tests).
// Usage: npm run api:record   (CATALOG_API_URL defaults to http://localhost:8000)
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const base = (process.env.CATALOG_API_URL || "http://localhost:8000").replace(/\/+$/, "");
const outDir = fileURLToPath(new URL("../tests/fixtures/api/", import.meta.url));

const endpoints = [
  ["clinic", "/api/v1/clinic"],
  ["clinic-rules", "/api/v1/clinic/rules?pageSize=100"],
  ["departments", "/api/v1/departments?pageSize=100"],
  ["doctors", "/api/v1/doctors?pageSize=100"],
  ["lab-test-categories", "/api/v1/lab-test-categories?pageSize=100"],
  ["lab-tests", "/api/v1/lab-tests?pageSize=100"],
  ["health-packages", "/api/v1/health-packages?pageSize=100"],
];

mkdirSync(outDir, { recursive: true });

try {
  for (const [name, path] of endpoints) {
    const res = await fetch(base + path, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(15_000) });
    if (!res.ok) throw new Error(`${path} answered ${res.status}`);
    const body = await res.json();
    writeFileSync(`${outDir}${name}.json`, `${JSON.stringify(body, null, 2)}\n`);
    console.log(`recorded ${name}`);
  }
} catch (error) {
  console.error(`Could not record fixtures from ${base}: ${error instanceof Error ? error.message : error}`);
  console.error("Start the seeded backend first (specs/004-catalog-api-integration/quickstart.md section 1).");
  process.exit(1);
}
