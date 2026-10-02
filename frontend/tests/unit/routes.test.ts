import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { departments } from "@/data/departments";
import { doctors } from "@/data/doctors";
import { healthTips } from "@/data/healthTips";
import { labTests } from "@/data/labTests";
import { quickActions } from "@/data/homeContent";
import { footerQuickLinks, legalLinks, primaryNav } from "@/data/navigation";
import {
  departmentPath,
  doctorPath,
  findPlaceholderRoute,
  isKnownPath,
  labTestPath,
  placeholderRoutes,
  ROUTES,
  tipPath,
} from "@/lib/routes";

const APP = join(process.cwd(), "src", "app");
const placeholderPaths = new Set(placeholderRoutes().map((route) => route.path));

/** Routes that have their own page.tsx under src/app (the catch-all is excluded). */
function realPageRoutes(dir = APP, prefix = ""): string[] {
  const routes: string[] = [];
  if (existsSync(join(dir, "page.tsx")) && prefix !== "") routes.push(prefix);
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory() && !entry.startsWith("[")) routes.push(...realPageRoutes(path, `${prefix}/${entry}`));
  }
  return routes;
}

describe("route registry", () => {
  it("has unique paths that start with / and have no trailing slash", () => {
    const all = placeholderRoutes().map((route) => route.path);
    expect(new Set(all).size).toBe(all.length);
    for (const path of all) {
      expect(path.startsWith("/")).toBe(true);
      expect(path.endsWith("/")).toBe(false);
    }
  });

  it("registers one path per department, lab test and tip, and none for pages that now exist", () => {
    for (const doctor of doctors) expect(placeholderPaths).not.toContain(doctorPath(doctor.slug));
    expect(placeholderPaths).not.toContain("/doctors");
    expect(placeholderPaths).not.toContain("/book-appointment");
    expect(placeholderPaths).not.toContain("/home-sample-collection");
    for (const test of labTests) expect(placeholderPaths).toContain(labTestPath(test.slug));
    for (const department of departments) expect(placeholderPaths).toContain(departmentPath(department.slug));
    for (const tip of healthTips) expect(placeholderPaths).toContain(tipPath(tip.slug));
    expect(placeholderPaths.size).toBe(9 + departments.length + labTests.length + healthTips.length);
  });

  it("gives every placeholder a title", () => {
    for (const route of placeholderRoutes()) expect(route.title.trim().length).toBeGreaterThan(0);
  });

  it("knows Home and the placeholders, and rejects anything else", () => {
    expect(isKnownPath("/")).toBe(true);
    expect(isKnownPath("/doctors")).toBe(true);
    expect(isKnownPath("/doctors/")).toBe(true);
    expect(isKnownPath("/doctors/dr-imran-qureshi")).toBe(true);
    expect(isKnownPath("/no-such-page")).toBe(false);
    expect(isKnownPath("/doctors/not-a-doctor")).toBe(false);
    expect(findPlaceholderRoute("/lab-tests")?.title).toBe("Lab Tests");
    expect(findPlaceholderRoute("/")).toBeUndefined();
  });

  it("does not register a path that now has a real page (remove it from the registry when one is added)", () => {
    const overlap = realPageRoutes().filter((route) => placeholderPaths.has(route));
    expect(overlap).toEqual([]);
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
