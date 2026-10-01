import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { departments } from "@/data/departments";
import { doctors } from "@/data/doctors";
import { healthTips } from "@/data/healthTips";
import { facts, heroFacts, quickActions, whyPoints } from "@/data/homeContent";
import { siteConfig } from "@/data/siteConfig";

/**
 * Constitution I (honesty) and V (no backend dependency), as automatic checks.
 *
 * Scans code with comments removed (comments legitimately say "no ratings, no awards"), and uses
 * whole-word matches so "reviewing a folder" or the CSS class "leading-none" do not trip it.
 */

// npm run test always runs from frontend/.
const SRC = join(process.cwd(), "src");

const BANNED_CLAIMS =
  /\b(ratings?|reviews?|testimonials?|awards?|award-winning|certified|certifications?|accredited|accreditations?|patients served|years of experience|best in|number one|top-rated)\b/i;

const BRAND_WORDS =
  /\b(apollo|aga khan|shifa|mayo clinic|cleveland clinic|johns hopkins|jci|iso 9001|google|facebook|whatsapp|pexels|unsplash|shutterstock)\b/i;

function filesUnder(dir: string, extensions: string[]): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return filesUnder(path, extensions);
    return extensions.some((extension) => entry.endsWith(extension)) ? [path] : [];
  });
}

/** Source without // and /* *\/ comments. */
function withoutComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
}

/** Import statements are code, not visitor-facing text (for example "next/font/google"). */
function withoutImports(source: string): string {
  return source
    .replace(/^import[\s\S]*?from\s+["'][^"']+["'];?$/gm, "")
    .replace(/^import\s+["'][^"']+["'];?$/gm, "");
}

function stringValues(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(stringValues);
  if (value && typeof value === "object") return Object.values(value).flatMap(stringValues);
  return [];
}

const codeFiles = filesUnder(SRC, [".ts", ".tsx"]).map((path) => ({
  path: path.replace(process.cwd(), "").split("\\").join("/"),
  code: withoutImports(withoutComments(readFileSync(path, "utf8"))),
}));

describe("no fabricated claims", () => {
  it("none of the sample data contains a claim word", () => {
    const text = stringValues([departments, doctors, healthTips, heroFacts, quickActions, facts, whyPoints, siteConfig]);
    const offenders = text.filter((value) => BANNED_CLAIMS.test(value));
    expect(offenders).toEqual([]);
  });

  it("none of the components or pages contains a claim word", () => {
    const offenders = codeFiles
      .filter((file) => file.path.includes("/components/") || file.path.includes("/app/"))
      .filter((file) => BANNED_CLAIMS.test(file.code))
      .map((file) => file.path);
    expect(offenders).toEqual([]);
  });

  it("the facts band and hero cards state no numbers except the department count and opening hours", () => {
    const numbers = [...facts, ...heroFacts].flatMap((fact) => ("value" in fact ? [fact.value, fact.label] : [fact.label]));
    const withDigits = numbers.filter((text) => /\d/.test(text));
    // "7" (departments) and the hours ("9 AM – 9 PM PKT") are the only digits allowed.
    expect(withDigits.sort()).toEqual(["7", "9 AM – 9 PM PKT", "Open Mon–Sat, 9 AM – 9 PM PKT"].sort());
  });
});

describe("no third-party brands", () => {
  it("the sample data, components, pages and image file names contain none", () => {
    const text = stringValues([departments, doctors, healthTips, siteConfig]);
    expect(text.filter((value) => BRAND_WORDS.test(value))).toEqual([]);
    const offenders = codeFiles.filter((file) => BRAND_WORDS.test(file.code)).map((file) => file.path);
    expect(offenders).toEqual([]);
    const imageNames = filesUnder(join(process.cwd(), "public", "images"), [".jpg", ".png", ".svg", ".webp"]);
    expect(imageNames.filter((name) => BRAND_WORDS.test(name))).toEqual([]);
  });
});

describe("no backend dependency (constitution V)", () => {
  it("src contains no fetch() call", () => {
    const offenders = codeFiles.filter((file) => /\bfetch\s*\(/.test(file.code)).map((file) => file.path);
    expect(offenders).toEqual([]);
  });

  it("src reads no environment variables", () => {
    const offenders = codeFiles.filter((file) => /\bprocess\.env\b/.test(file.code)).map((file) => file.path);
    expect(offenders).toEqual([]);
  });

  it("src has no XMLHttpRequest, WebSocket or axios", () => {
    const offenders = codeFiles.filter((file) => /\b(XMLHttpRequest|WebSocket|axios)\b/.test(file.code)).map((file) => file.path);
    expect(offenders).toEqual([]);
  });
});

describe("the checks themselves", () => {
  it("catch what they are meant to catch", () => {
    expect(BANNED_CLAIMS.test("Rated 4.9 by our reviews")).toBe(true);
    expect(BANNED_CLAIMS.test("An award-winning clinic")).toBe(true);
    expect(BANNED_CLAIMS.test("ISO certified")).toBe(true);
    expect(BANNED_CLAIMS.test("Doctor reviewing a folder")).toBe(false);
    expect(BANNED_CLAIMS.test("leading-none")).toBe(false);
    expect(BRAND_WORDS.test("In partnership with Apollo")).toBe(true);
    expect(withoutComments("const a = 1; // no ratings here\n/* no awards */ const b = 2;")).not.toMatch(/ratings|awards/);
    expect(withoutComments('const url = "https://example.com";')).toContain("https://example.com");
    expect(withoutImports('import { Inter } from "next/font/google";\nconst a = 1;')).not.toMatch(/google/);
    expect(withoutImports('import {\n  A,\n  B,\n} from "@/x/google";\nconst keep = 1;')).toContain("keep");
    // Only imports are skipped: the same word in a visible string is still caught.
    expect(withoutImports('const label = "Powered by Google";')).toMatch(/Google/);
  });
});
