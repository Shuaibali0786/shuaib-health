import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { departments } from "@/data/departments";
import { doctors } from "@/data/doctors";
import { healthTips } from "@/data/healthTips";
import { labTests } from "@/data/labTests";
import { quickActions } from "@/data/homeContent";
import { footerQuickLinks, legalLinks, primaryNav } from "@/data/navigation";
import { isKnownPath, knownPaths } from "@/lib/pages";
import { departmentPath, doctorPath, labTestPath, ROUTES, tipPath } from "@/lib/routes";

const APP = join(process.cwd(), "src", "app");

/** Routes that have their own page.tsx under src/app. */
function pageRoutes(dir = APP, prefix = ""): string[] {
  const routes: string[] = [];
  if (existsSync(join(dir, "page.tsx")) && prefix !== "") routes.push(prefix);
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory() && !entry.startsWith("[")) routes.push(...pageRoutes(path, `${prefix}/${entry}`));
  }
  return routes;
}

describe("known paths", () => {
  it("has unique paths that start with / and have no trailing slash", () => {
    const all = knownPaths();
    expect(new Set(all).size).toBe(all.length);
    for (const path of all) {
      expect(path.startsWith("/")).toBe(true);
      if (path !== "/") expect(path.endsWith("/")).toBe(false);
    }
  });

  it("has no catch-all route", () => {
    expect(existsSync(join(APP, "[...slug]"))).toBe(false);
  });

  it("knows real pages and rejects anything else", () => {
    expect(isKnownPath("/")).toBe(true);
    expect(isKnownPath("/doctors")).toBe(true);
    expect(isKnownPath("/doctors/")).toBe(true);
    expect(isKnownPath("/faq#home-sample-collection")).toBe(true);
    expect(isKnownPath("/doctors/dr-imran-qureshi")).toBe(true);
    expect(isKnownPath("/lab-tests/esr")).toBe(true);
    expect(isKnownPath("/no-such-page")).toBe(false);
    expect(isKnownPath("/doctors/not-a-doctor")).toBe(false);
    expect(isKnownPath("/home-sample-collection")).toBe(false);
  });

  it("lists every page.tsx route in the manifest", () => {
    const known = knownPaths();
    for (const route of pageRoutes()) expect(known, route).toContain(route);
  });
});

describe("no dead links (FR-024)", () => {
  const hrefs: Array<[string, string]> = [
    ...primaryNav.map((item): [string, string] => [`nav ${item.label}`, item.href]),
    ...footerQuickLinks.map((item): [string, string] => [`footer ${item.label}`, item.href]),
    ...legalLinks.map((item): [string, string] => [`legal ${item.label}`, item.href]),
    ...quickActions.map((action): [string, string] => [`quick action ${action.label}`, action.href]),
    ...doctors.map((doctor): [string, string] => [`doctor ${doctor.slug}`, doctorPath(doctor.slug)]),
    ...departments.map((department): [string, string] => [`department ${department.slug}`, departmentPath(department.slug)]),
    ...labTests.map((test): [string, string] => [`lab test ${test.slug}`, labTestPath(test.slug)]),
    ...healthTips.map((tip): [string, string] => [`tip ${tip.slug}`, tipPath(tip.slug)]),
    ...Object.entries(ROUTES).map(([name, href]): [string, string] => [`ROUTES.${name}`, href]),
  ];

  it.each(hrefs)("%s resolves", (_name, href) => {
    expect(isKnownPath(href)).toBe(true);
  });
});
