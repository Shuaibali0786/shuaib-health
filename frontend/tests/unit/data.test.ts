import { describe, expect, it, vi } from "vitest";
import { departments } from "../fixtures/catalog/departments";
import { doctors } from "../fixtures/catalog/doctors";
import { healthTips } from "@/data/healthTips";
import { labTests } from "../fixtures/catalog/labTests";
import { buildFacts, heroFacts, quickActions, whyPoints } from "@/data/homeContent";
import { footerQuickLinks, legalLinks, primaryNav } from "@/data/navigation";
import { siteConfig } from "../fixtures/catalog/siteConfig";
import { countWords } from "@/lib/readingTime";
import { BANNED_CLAIMS, BRAND_WORDS, stringValues } from "./helpers/forbidden";
import {
  getDepartmentBySlug,
  getDepartments,
  getDoctorBySlug,
  getFeaturedDoctors,
  getHealthTipBySlug,
  getLatestHealthTips,
  getSiteConfig,
} from "@/lib/content";

vi.mock("@/lib/api/cached", async () => (await import("./helpers/catalog-api-mock")).catalogApiMock);

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const unique = (values: unknown[]) => new Set(values).size === values.length;

describe("departments (data-model rule 1)", () => {
  it("has exactly the seven departments in the order the spec requires", () => {
    expect(departments.map((department) => department.name)).toEqual([
      "General Medicine",
      "Cardiology",
      "Pediatrics",
      "Gynecology",
      "Dermatology",
      "Dental",
      "Pathology Lab",
    ]);
  });

  it("has unique ids, slugs and sort orders, with sort order 1 to 7 matching the list order", () => {
    expect(unique(departments.map((department) => department.id))).toBe(true);
    expect(unique(departments.map((department) => department.slug))).toBe(true);
    expect(departments.map((department) => department.sortOrder)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it("has one-line summaries of at most 90 characters", () => {
    for (const department of departments) {
      expect(department.summary.length).toBeGreaterThan(0);
      expect(department.summary.length).toBeLessThanOrEqual(90);
    }
  });
});

describe("slugs (rule 2)", () => {
  it("are kebab-case and unique within their type", () => {
    for (const list of [departments, doctors, healthTips, labTests]) {
      for (const item of list) expect(item.slug).toMatch(SLUG);
      expect(unique(list.map((item) => item.slug))).toBe(true);
    }
  });

  it("have unique ids across doctors and tips too", () => {
    expect(unique(doctors.map((doctor) => doctor.id))).toBe(true);
    expect(unique(healthTips.map((tip) => tip.id))).toBe(true);
  });
});

describe("doctors (rule 3)", () => {
  it("each belongs to an existing department and uses its name as the specialty", () => {
    for (const doctor of doctors) {
      const department = departments.find((candidate) => candidate.id === doctor.departmentId);
      expect(department, doctor.fullName).toBeDefined();
      expect(doctor.specialty).toBe(department?.name);
    }
  });

  it("have whole-rupee fees between PKR 500 and PKR 50,000", () => {
    for (const doctor of doctors) {
      expect(Number.isInteger(doctor.feePkr)).toBe(true);
      expect(doctor.feePkr).toBeGreaterThanOrEqual(500);
      expect(doctor.feePkr).toBeLessThanOrEqual(50_000);
    }
  });

  it("feature the original four on Home, and carry no rating or review fields", () => {
    const featured = doctors.filter((doctor) => doctor.isFeatured);
    expect(featured.map((doctor) => doctor.slug)).toEqual([
      "dr-hassan-mirza",
      "dr-imran-qureshi",
      "dr-sana-farooqui",
      "dr-ayesha-rahman",
    ]);
    for (const doctor of doctors) {
      expect(Object.keys(doctor).sort()).toEqual(
        [
          "bio",
          "departmentId",
          "experienceYears",
          "feePkr",
          "fullName",
          "id",
          "isFeatured",
          "isSample",
          "languages",
          "photo",
          "qualifications",
          "schedule",
          "slug",
          "specialty",
        ].sort(),
      );
      expect(doctor.fullName.startsWith("Dr. ")).toBe(true);
    }
  });
});

describe("health tips (rule 4)", () => {
  it("has at least three tips, so showing the latest three is a real selection", () => {
    expect(healthTips.length).toBeGreaterThanOrEqual(3);
  });

  it("has at least six articles of 250-400 words, each with a body, and no forbidden phrases (invariant 6)", () => {
    expect(healthTips.length).toBeGreaterThanOrEqual(6);
    for (const tip of healthTips) {
      expect(tip.body.length, tip.slug).toBeGreaterThan(0);
      expect(countWords(tip.body), tip.slug).toBeGreaterThanOrEqual(250);
      expect(countWords(tip.body), tip.slug).toBeLessThanOrEqual(400);
      const text = stringValues(tip.body);
      expect(text.filter((value) => BANNED_CLAIMS.test(value) || BRAND_WORDS.test(value)), tip.slug).toEqual([]);
      expect(text.filter((value) => /(dosage|prescribe[ds]?|cures?|diagnos(e|is|ed))/i.test(value)), tip.slug).toEqual([]);
    }
  });

  it("uses every category on at least one article, with the five expected categories", () => {
    expect([...new Set(healthTips.map((tip) => tip.category))].sort()).toEqual(["Activity", "Hygiene", "Mental wellbeing", "Nutrition", "Sleep"]);
  });

  it("keeps the original four articles as Home's three newest", async () => {
    expect((await getLatestHealthTips(3)).map((tip) => tip.slug)).toEqual(["staying-hydrated", "healthy-sleep-habits", "balanced-plate"]);
    for (const tip of healthTips.filter((candidate) => ["hand-hygiene", "managing-stress"].includes(candidate.slug))) {
      expect(Date.parse(tip.publishedAt)).toBeLessThan(Date.parse("2026-08-14T09:00:00+05:00"));
    }
  });

  it("have Karachi-offset timestamps that parse", () => {
    for (const tip of healthTips) {
      expect(tip.publishedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\+05:00$/);
      expect(Number.isNaN(Date.parse(tip.publishedAt))).toBe(false);
      expect(tip.title.length).toBeLessThanOrEqual(80);
      expect(tip.summary.length).toBeLessThanOrEqual(160);
    }
  });
});

describe("sample flags (rule 5)", () => {
  it("marks every record as sample", () => {
    for (const record of [...departments, ...doctors, ...healthTips, ...labTests, siteConfig]) {
      expect(record.isSample).toBe(true);
    }
  });
});

describe("images (rule 6)", () => {
  it("every image has non-empty alt text and positive dimensions", () => {
    const images = [
      ...departments.map((department) => department.image),
      ...doctors.map((doctor) => doctor.photo),
      ...healthTips.map((tip) => tip.image),
    ];
    for (const image of images) {
      expect(image.alt.trim().length).toBeGreaterThan(0);
      expect(image.width).toBeGreaterThan(0);
      expect(image.height).toBeGreaterThan(0);
    }
  });
});

describe("site config (rule 7)", () => {
  it("has the exact demo notice, credit text and credit link from the spec", () => {
    expect(siteConfig.demoNotice).toBe("Portfolio demo — not a real clinic, not medical advice.");
    expect(siteConfig.credit).toEqual({
      text: "Designed & built by Shuaib Ali",
      href: "https://github.com/Shuaibali0786",
    });
  });

  it("uses Karachi time, hides the site from search engines and uses invalid-by-construction sample phones", () => {
    expect(siteConfig.timeZone).toBe("Asia/Karachi");
    expect(siteConfig.indexable).toBe(false);
    for (const phone of [siteConfig.emergencyPhone, siteConfig.generalPhone]) {
      expect(phone.tel).toMatch(/^\+92210000000\d$/);
    }
  });

  it("describes opening hours as Monday to Saturday, 09:00 to 21:00", () => {
    expect(siteConfig.openingHours).toEqual([
      { days: ["mon", "tue", "wed", "thu", "fri", "sat"], opens: "09:00", closes: "21:00" },
    ]);
  });
});

describe("home page copy and navigation", () => {
  it("has exactly three hero facts, five quick actions, four facts and four to five why-points", () => {
    expect(heroFacts).toHaveLength(3);
    expect(quickActions.map((action) => action.label)).toEqual([
      "Find a Doctor",
      "Book Appointment",
      "Lab Tests",
      "Health Packages",
      "Home Sample Collection",
    ]);
    expect(buildFacts(departments.length)).toHaveLength(4);
    expect(buildFacts(undefined)).toHaveLength(4);
    expect(whyPoints.length).toBeGreaterThanOrEqual(4);
    expect(whyPoints.length).toBeLessThanOrEqual(5);
  });

  it("has the eight navigation links in the required order", () => {
    expect(primaryNav.map((item) => item.label)).toEqual([
      "Home",
      "About",
      "Doctors",
      "Departments",
      "Lab Tests",
      "Health Packages",
      "Health Tips",
      "Contact",
    ]);
    expect(footerQuickLinks.at(-1)).toEqual({ label: "Book Appointment", href: "/book-appointment" });
    expect(legalLinks.map((item) => item.label)).toEqual(["Privacy", "Terms"]);
  });
});

describe("content accessors", () => {
  it("returns departments in display order and finds one by slug", async () => {
    const list = await getDepartments();
    expect(list.map((department) => department.sortOrder)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect((await getDepartmentBySlug("cardiology"))?.name).toBe("Cardiology");
    expect(await getDepartmentBySlug("nope")).toBeUndefined();
  });

  it("returns three or four featured doctors, clamping the requested limit", async () => {
    expect(await getFeaturedDoctors()).toHaveLength(4);
    expect(await getFeaturedDoctors(1)).toHaveLength(3);
    expect(await getFeaturedDoctors(99)).toHaveLength(4);
    expect((await getDoctorBySlug("dr-sana-farooqui"))?.specialty).toBe("Pediatrics");
    expect(await getDoctorBySlug("nope")).toBeUndefined();
  });

  it("returns the newest tips first", async () => {
    const latest = await getLatestHealthTips(3);
    expect(latest.map((tip) => tip.slug)).toEqual(["staying-hydrated", "healthy-sleep-habits", "balanced-plate"]);
    const dates = latest.map((tip) => Date.parse(tip.publishedAt));
    expect([...dates].sort((a, b) => b - a)).toEqual(dates);
    expect((await getHealthTipBySlug("daily-walk"))?.category).toBe("Activity");
    expect(await getLatestHealthTips(0)).toEqual([]);
  });

  it("returns the site config", async () => {
    expect(await getSiteConfig()).toBe(siteConfig);
  });
});
