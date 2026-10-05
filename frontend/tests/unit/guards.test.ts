import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";

const SRC = join(process.cwd(), "src");

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

/** Removes comments so prose that mentions a banned API is not a finding. */
function stripComments(code: string): string {
  return code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

const files = walk(SRC)
  .filter((path) => /\.(ts|tsx)$/.test(path))
  .map((path) => ({ path: relative(SRC, path).split(sep).join("/"), code: stripComments(readFileSync(path, "utf8")) }));

/** Source files that match a pattern, as a list for a readable failure. */
const offenders = (pattern: RegExp, skip: (path: string) => boolean = () => false) =>
  files.filter((file) => !skip(file.path) && pattern.test(file.code)).map((file) => file.path);

describe("static-site guards (no backend, no storage, no unsafe HTML)", () => {
  // Features 004 and 005: the catalog reader, the booking proxy and the booking flow's browser client are the only places that may call fetch;
  // the API settings are read in lib/api/config.ts, and the start-up check in instrumentation.ts reads
  // the framework's own NEXT_RUNTIME / NEXT_PHASE.
  it("has no fetch( in src outside lib/api/http.ts, lib/booking/backend.ts and lib/booking/client.ts", () => {
    expect(offenders(/\bfetch\s*\(/, (path) => ["lib/api/http.ts", "lib/booking/backend.ts", "lib/booking/client.ts"].includes(path))).toEqual([]);
  });

  it("has no backend env names in src outside lib/api/config.ts and instrumentation.ts", () => {
    expect(
      offenders(/process\.env\.(?!SITE_URL\b|NODE_ENV\b)[A-Z_]+/, (path) => path === "lib/api/config.ts" || path === "instrumentation.ts"),
    ).toEqual([]);
  });

  it.each([
    ["XMLHttpRequest", /\bXMLHttpRequest\b/],
    ["localStorage", /\blocalStorage\b/],
    ["sessionStorage", /\bsessionStorage\b/],
    ["document.cookie", /document\.cookie/],
    ["raw <img", /<img[\s>]/],
  ])("has no %s in src", (_name, pattern) => {
    expect(offenders(pattern)).toEqual([]);
  });

  it("has no dangerouslySetInnerHTML in src outside the JSON-LD component", () => {
    expect(offenders(/dangerouslySetInnerHTML/, (path) => path === "components/seo/JsonLd.tsx")).toEqual([]);
  });

  it("has no hex colour literal in components or pages (tokens live in globals.css)", () => {
    const hex = /#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b(?![\w-])/;
    const inScope = (path: string) => !(path.startsWith("components/") || path.startsWith("app/"));
    // Icon and image generators and the theme-color constant need literal colours (tokens.test.ts checks the constant).
    const generators = (path: string) => inScope(path) || /(opengraph-image|apple-icon|icon|theme-color)\.(tsx|svg|ts)$/.test(path);
    expect(offenders(hex, generators)).toEqual([]);
  });

  it("uses an external URL only for the OpenStreetMap embed, the GitHub credit and the WhatsApp share link", () => {
    const allowed = /openstreetmap\.org|github\.com\/Shuaibali0786|schema\.org|w3\.org\/(2000\/svg|1999\/xlink)|localhost|^https:\/\/wa\.me\/\?text=/;
    const found = files.flatMap((file) =>
      (file.code.match(/https?:\/\/[^\s"'`)]+/g) ?? []).filter((url) => !allowed.test(url)).map((url) => `${file.path}: ${url}`),
    );
    expect(found).toEqual([]);
  });

  it("keeps the OpenStreetMap URL inside MapEmbed.tsx", () => {
    expect(offenders(/openstreetmap\.org/, (path) => path === "components/contact/MapEmbed.tsx")).toEqual([]);
  });
});
