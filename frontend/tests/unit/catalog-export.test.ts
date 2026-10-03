import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { buildCatalog } from "../../scripts/catalog-object.mjs";

/**
 * The backend seeds its database from backend/app/seed/data/catalog.json, which is exported
 * from these mock files. This test fails when the two drift apart.
 */
describe("backend seed catalog", () => {
  it("is identical to the current mock data", () => {
    const path = resolve(process.cwd(), "..", "backend", "app", "seed", "data", "catalog.json");
    const committed: unknown = JSON.parse(readFileSync(path, "utf8"));
    const current: unknown = JSON.parse(JSON.stringify(buildCatalog()));
    expect(
      committed,
      "backend catalog.json is out of date: run `npm run export:catalog` in frontend/ and commit it",
    ).toEqual(current);
  });
});
