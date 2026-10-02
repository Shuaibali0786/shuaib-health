import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { departments } from "@/data/departments";
import { doctors } from "@/data/doctors";
import { labTestCategories, labTests } from "@/data/labTests";
import { siteConfig } from "@/data/siteConfig";
import { availableDays } from "@/lib/schedule";
import { getDoctorsByDepartment, getLabTestBySlug, getLabTestCategories, getLabTests, getLabTestsBySlugs } from "@/lib/content";
import { BANNED_CLAIMS, BRAND_WORDS, stringValues } from "./helpers/forbidden";

const unique = (values: unknown[]) => new Set(values).size === values.length;
const toMinutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
const LANGUAGES = ["Urdu", "English", "Sindhi", "Punjabi"];

describe("doctors (data-model invariants 1 and 2)", () => {
  it("has nine doctors, with the four original photos unchanged", () => {
    expect(doctors).toHaveLength(9);
    const original = {
      "dr-hassan-mirza": "/images/doctors/dr-hassan-mirza.jpg",
      "dr-imran-qureshi": "/images/doctors/dr-imran-qureshi.jpg",
      "dr-sana-farooqui": "/images/doctors/dr-sana-farooqui.jpg",
      "dr-ayesha-rahman": "/images/doctors/dr-ayesha-rahman.jpg",
    };
    for (const [slug, src] of Object.entries(original)) {
      expect(doctors.find((doctor) => doctor.slug === slug)?.photo.src).toBe(src);
    }
  });

  it("puts one doctor in each department, and two in General Medicine and Pediatrics", () => {
    for (const department of departments) {
      const inDepartment = doctors.filter((doctor) => doctor.departmentId === department.id);
      const expected = ["general-medicine", "pediatrics"].includes(department.slug) ? 2 : 1;
      expect(inDepartment, department.name).toHaveLength(expected);
    }
  });

  it("points every photo at an existing 600 x 750 file with real alt text", () => {
    for (const doctor of doctors) {
      expect(doctor.photo.src).toBe(`/images/doctors/${doctor.slug}.jpg`);
      expect(existsSync(join(process.cwd(), "public", doctor.photo.src)), doctor.slug).toBe(true);
      expect(doctor.photo.width).toBe(600);
      expect(doctor.photo.height).toBe(750);
      expect(doctor.photo.alt).toMatch(/^Stock photo of a model presented as sample doctor Dr\. /);
      expect(doctor.photo.alt.toLowerCase()).not.toContain("not a real");
    }
  });

  it("has Monday-to-Saturday sessions inside 9 AM to 9 PM, without overlaps", () => {
    for (const doctor of doctors) {
      expect(doctor.schedule.length, doctor.slug).toBeGreaterThanOrEqual(2);
      for (const session of doctor.schedule) {
        expect(["mon", "tue", "wed", "thu", "fri", "sat"]).toContain(session.day);
        expect(toMinutes(session.start), doctor.slug).toBeGreaterThanOrEqual(9 * 60);
        expect(toMinutes(session.end), doctor.slug).toBeLessThanOrEqual(21 * 60);
        expect(toMinutes(session.start)).toBeLessThan(toMinutes(session.end));
      }
      for (const day of availableDays(doctor.schedule)) {
        const sessions = doctor.schedule.filter((session) => session.day === day).sort((a, b) => toMinutes(a.start) - toMinutes(b.start));
        sessions.slice(1).forEach((session, index) => {
          expect(toMinutes(session.start), `${doctor.slug} ${day}`).toBeGreaterThanOrEqual(toMinutes((sessions[index] as { end: string }).end));
        });
      }
    }
  });

  it("covers every weekday from Monday to Saturday with at least one doctor", () => {
    const covered = new Set(doctors.flatMap((doctor) => availableDays(doctor.schedule)));
    expect([...covered].sort()).toEqual(["fri", "mon", "sat", "thu", "tue", "wed"]);
  });

  it("uses only the four languages, generic qualifications and plausible sample figures", () => {
    for (const doctor of doctors) {
      expect(doctor.languages.length).toBeGreaterThanOrEqual(1);
      expect(doctor.languages.length).toBeLessThanOrEqual(4);
      for (const language of doctor.languages) expect(LANGUAGES).toContain(language);
      expect(doctor.qualifications.length).toBeGreaterThanOrEqual(1);
      expect(doctor.qualifications.length).toBeLessThanOrEqual(3);
      expect(Number.isInteger(doctor.experienceYears)).toBe(true);
      expect(doctor.experienceYears).toBeGreaterThanOrEqual(3);
      expect(doctor.experienceYears).toBeLessThanOrEqual(30);
      expect(doctor.bio.length).toBeGreaterThan(60);
    }
    expect(new Set(doctors.flatMap((doctor) => doctor.languages))).toEqual(new Set(LANGUAGES));
  });

  it("contains no claim, brand or institution words", () => {
    const text = stringValues(doctors.map(({ photo, ...rest }) => ({ ...rest, alt: photo.alt })));
    expect(text.filter((value) => BANNED_CLAIMS.test(value) || BRAND_WORDS.test(value))).toEqual([]);
  });
});

describe("departments (data-model invariant 3)", () => {
  it("has an overview, general conditions and services, and at least three real related tests", () => {
    for (const department of departments) {
      expect(department.overview.length, department.slug).toBeGreaterThan(60);
      expect(department.conditions.length).toBeGreaterThanOrEqual(4);
      expect(department.conditions.length).toBeLessThanOrEqual(8);
      expect(department.services.length).toBeGreaterThanOrEqual(4);
      expect(department.services.length).toBeLessThanOrEqual(8);
      expect(department.relatedTestSlugs.length, department.slug).toBeGreaterThanOrEqual(3);
      expect(unique(department.relatedTestSlugs)).toBe(true);
      for (const slug of department.relatedTestSlugs) {
        expect(labTests.some((test) => test.slug === slug), `${department.slug} -> ${slug}`).toBe(true);
      }
    }
  });

  it("contains no claim, brand or institution words", () => {
    const text = stringValues(departments.map((department) => ({ ...department, image: undefined })));
    expect(text.filter((value) => BANNED_CLAIMS.test(value) || BRAND_WORDS.test(value))).toEqual([]);
  });
});

describe("lab tests (data-model invariant 5)", () => {
  it("has the nine categories in order", () => {
    expect(labTestCategories.map((category) => category.name)).toEqual([
      "Blood",
      "Diabetes",
      "Heart",
      "Liver",
      "Kidney",
      "Thyroid",
      "Vitamins",
      "Hormones",
      "Urine",
    ]);
    expect(unique(labTestCategories.map((category) => category.slug))).toBe(true);
  });

  it("has at least 24 tests with at least two in every category", () => {
    expect(labTests.length).toBeGreaterThanOrEqual(24);
    for (const category of labTestCategories) {
      expect(labTests.filter((test) => test.categoryId === category.id).length, category.name).toBeGreaterThanOrEqual(2);
    }
  });

  it("has unique ids and slugs and a real category and departments for each test", () => {
    expect(unique(labTests.map((test) => test.id))).toBe(true);
    expect(unique(labTests.map((test) => test.slug))).toBe(true);
    for (const test of labTests) {
      expect(labTestCategories.some((category) => category.id === test.categoryId), test.slug).toBe(true);
      expect(test.relatedDepartmentIds.length).toBeGreaterThanOrEqual(1);
      for (const id of test.relatedDepartmentIds) expect(departments.some((department) => department.id === id), `${test.slug} -> ${id}`).toBe(true);
    }
  });

  it("has whole-rupee sample prices from PKR 300 to PKR 6,000 and every logistics field", () => {
    for (const test of labTests) {
      expect(Number.isInteger(test.pricePkr)).toBe(true);
      expect(test.pricePkr, test.slug).toBeGreaterThanOrEqual(300);
      expect(test.pricePkr, test.slug).toBeLessThanOrEqual(6000);
      for (const field of [test.sampleType, test.reportTime, test.preparation, test.about]) expect(field.trim().length).toBeGreaterThan(0);
      expect(typeof test.homeCollection).toBe("boolean");
    }
  });

  it("gives logistics only: no reference ranges, units or diagnosis wording", () => {
    for (const test of labTests) {
      expect(test.about, test.slug).not.toMatch(/\d\s?(mg|g|ng|pg|iu|mmol|umol|%)\b/i);
      expect(test.about, test.slug).not.toMatch(/\b(normal range|reference range|high means|low means|diagnos(e|is)|cures?)\b/i);
      expect(test.about.length).toBeLessThanOrEqual(130);
    }
  });

  it("contains no claim, brand or institution words", () => {
    const text = stringValues([labTests, labTestCategories]);
    expect(text.filter((value) => BANNED_CLAIMS.test(value) || BRAND_WORDS.test(value))).toEqual([]);
  });

  it("makes the sample hours explicit in the site config", () => {
    expect(siteConfig.labHours).toEqual([{ days: ["mon", "tue", "wed", "thu", "fri", "sat"], opens: "08:00", closes: "20:00" }]);
    expect(siteConfig.mapArea.bbox[0]).toBeLessThan(siteConfig.mapArea.bbox[2]);
    expect(siteConfig.mapArea.bbox[1]).toBeLessThan(siteConfig.mapArea.bbox[3]);
  });
});

describe("content accessors for the new data", () => {
  it("returns doctors by department and lab tests by slug", async () => {
    expect((await getDoctorsByDepartment("dept-pediatrics")).map((doctor) => doctor.slug)).toEqual(["dr-sana-farooqui", "dr-faisal-chaudhry"]);
    expect((await getLabTestBySlug("hba1c"))?.name).toBe("HbA1c");
    expect(await getLabTestBySlug("nope")).toBeUndefined();
    expect(await getLabTests()).toHaveLength(labTests.length);
    expect(await getLabTestCategories()).toHaveLength(9);
  });

  it("keeps the requested order and skips unknown slugs", async () => {
    const result = await getLabTestsBySlugs(["tsh", "nope", "hba1c"]);
    expect(result.map((test) => test.slug)).toEqual(["tsh", "hba1c"]);
  });
});
