import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { doctors } from "../fixtures/catalog/doctors";
import { labTests } from "../fixtures/catalog/labTests";
import { siteConfig } from "../fixtures/catalog/siteConfig";

// FR-002: no sample clinic or catalog values in src/. The site gets them from the API (or the
// validated fallback), never from the bundle. Comments may mention the sample clinic.

const SRC = join(process.cwd(), "src");

/**
 * Editorial copy that is about the demo itself rather than catalog or clinic data. It is the only
 * place the sample clinic's name may remain: the About and legal text say "Shuaib Health is a
 * portfolio demo", which is part of the honesty statement (constitution I), not clinic settings.
 */
const EDITORIAL_ALLOWLIST = [
  "/src/data/aboutContent.ts",
  "/src/data/legalContent.ts",
  // "Powered by Shuaib Health" names the platform (the product brand, the same for every clinic), not the clinic's own name.
  "/src/components/brand/PoweredBy.tsx",
];

function filesUnder(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return filesUnder(path);
    return /\.(ts|tsx)$/.test(entry) ? [path] : [];
  });
}

function withoutComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
}

const files = filesUnder(SRC).map((path) => ({
  path: path.replace(process.cwd(), "").split("\\").join("/"),
  code: withoutComments(readFileSync(path, "utf8")),
}));

/**
 * Generic search examples in UI copy that happen to equal a sample test's name. They tell visitors
 * what an "alternative name" looks like; they do not read any catalog record.
 */
const ALLOWED_MENTIONS = [
  { path: "/src/components/lab-tests/LabTestBrowser.tsx", needle: "HbA1c" },
  { path: "/src/data/faq.ts", needle: "HbA1c" },
];

const forbidden: Array<[label: string, needle: string]> = [
  ["the sample clinic name", siteConfig.name],
  ["the sample emergency phone", siteConfig.emergencyPhone.display],
  ["the sample emergency phone (E.164)", siteConfig.emergencyPhone.tel],
  ["the sample general phone", siteConfig.generalPhone.display],
  ["the sample general phone (E.164)", siteConfig.generalPhone.tel],
  ["the sample address", siteConfig.address[0]!],
  ...doctors.map((doctor): [string, string] => [`doctor "${doctor.fullName}"`, doctor.fullName]),
  ...labTests.map((test): [string, string] => [`lab test "${test.name}"`, test.name]),
];

describe("no sample clinic or catalog values in src (FR-002)", () => {
  it("scans real files", () => {
    expect(files.length).toBeGreaterThan(50);
    expect(forbidden.length).toBeGreaterThan(20);
  });

  it("contains none of the sample clinic details, doctors or lab tests", () => {
    const hits = files
      .filter((file) => !EDITORIAL_ALLOWLIST.includes(file.path))
      .flatMap((file) => forbidden
          .filter(([, needle]) => file.code.includes(needle))
          .filter(([, needle]) => !ALLOWED_MENTIONS.some((mention) => mention.path === file.path && mention.needle === needle)).map(([label]) => `${file.path}: ${label}`));
    expect(hits).toEqual([]);
  });

  it("limits the editorial exception to the files that are allowed it", () => {
    for (const path of EDITORIAL_ALLOWLIST) expect(files.map((file) => file.path)).toContain(path);
    const mentionsClinicName = files.filter((file) => file.code.includes(siteConfig.name)).map((file) => file.path);
    expect(mentionsClinicName.every((path) => EDITORIAL_ALLOWLIST.includes(path))).toBe(true);
  });

  it("the check itself catches a planted value", () => {
    const planted = `const x = "${doctors[0]!.fullName}";`;
    expect(forbidden.some(([, needle]) => planted.includes(needle))).toBe(true);
  });
});
