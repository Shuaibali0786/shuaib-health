// @vitest-environment node
import { describe, expect, it } from "vitest";

import { srcFiles } from "./helpers/src-files";

// FR-006/SC-006: the API layer is server-only and no browser code can reach it or the settings it reads.
const files = srcFiles();
const GENERATED = new Set(["lib/api/schema.gen.ts", "lib/api/schemas.ts"]);
const importsOf = (code: string, target: RegExp) =>
  [...code.matchAll(/(?:from|import)\s*\(?\s*["']([^"']+)["']/g)].map((m) => m[1] ?? "").filter((s) => target.test(s));
const isClientFile = (text: string) => /^\s*(?:\/\*[\s\S]*?\*\/\s*)*["']use client["']/.test(text);

describe("server-only boundary", () => {
  it("starts every src/lib/api file (except the generated types and schemas) with import \"server-only\"", () => {
    const offenders = files
      .filter((f) => f.path.startsWith("lib/api/") && !GENERATED.has(f.path))
      .filter((f) => !/^\s*(?:\/\*[\s\S]*?\*\/\s*|\/\/[^\n]*\n\s*)*import\s+["']server-only["']/.test(f.text))
      .map((f) => f.path);
    expect(offenders).toEqual([]);
    expect(files.filter((f) => f.path.startsWith("lib/api/")).length).toBeGreaterThan(3);
  });

  it("has no component importing @/lib/api", () => {
    const offenders = files.filter((f) => f.path.startsWith("components/") && importsOf(f.code, /^@\/lib\/api(\/|$)/).length > 0);
    expect(offenders.map((f) => f.path)).toEqual([]);
  });

  it("has no \"use client\" file importing @/lib/content or @/lib/api", () => {
    const clients = files.filter((f) => isClientFile(f.text));
    expect(clients.length).toBeGreaterThan(0);
    const offenders = clients.filter((f) => importsOf(f.code, /^@\/lib\/(content|api)(\/|$)/).length > 0);
    expect(offenders.map((f) => f.path)).toEqual([]);
  });

  it("reads the server-only variables only in src/lib/api/config.ts", () => {
    const names = /process\.env\.(CATALOG_API_URL|CLINIC_FALLBACK_JSON|CATALOG_DATA_REVALIDATE_SECONDS)|process\.env\[\s*["'](CATALOG_API_URL|CLINIC_FALLBACK_JSON|CATALOG_DATA_REVALIDATE_SECONDS)/;
    const readers = files.filter((f) => names.test(f.code)).map((f) => f.path);
    expect(readers).toEqual(["lib/api/config.ts"]);
  });
});
