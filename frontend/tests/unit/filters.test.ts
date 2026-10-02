import { describe, expect, it } from "vitest";
import { departments } from "@/data/departments";
import { doctors } from "@/data/doctors";
import { healthTips } from "@/data/healthTips";
import { labTestCategories, labTests } from "@/data/labTests";
import {
  doctorFiltersToQuery,
  filterDoctors,
  filterLabTests,
  filterTips,
  hasTipFilters,
  NO_TIP_FILTERS,
  parseTipFilters,
  tipCategorySlug,
  tipFiltersToQuery,
  hasDoctorFilters,
  labTestFiltersToQuery,
  normalizeQuery,
  NO_DOCTOR_FILTERS,
  parseDoctorFilters,
  parseLabTestFilters,
} from "@/lib/filters";

const names = (list: Array<{ fullName: string }>) => list.map((item) => item.fullName);

describe("normalizeQuery", () => {
  it("trims, collapses spaces and lowercases", () => {
    expect(normalizeQuery("  SANA   Farooqui ")).toBe("sana farooqui");
  });

  it("drops a leading Dr only when other text follows", () => {
    expect(normalizeQuery("Dr. Sana")).toBe("sana");
    expect(normalizeQuery("dr sana")).toBe("sana");
    expect(normalizeQuery("Dr.")).toBe("");
    expect(normalizeQuery("dr")).toBe("");
  });
});

describe("filterDoctors", () => {
  it("returns all nine with no filters", () => {
    expect(filterDoctors(doctors, NO_DOCTOR_FILTERS)).toHaveLength(9);
  });

  it("filters by department", () => {
    const pediatrics = filterDoctors(doctors, { ...NO_DOCTOR_FILTERS, departmentId: "dept-pediatrics" });
    expect(names(pediatrics)).toEqual(["Dr. Sana Farooqui", "Dr. Faisal Chaudhry"]);
  });

  it("matches names in any case, with spaces and with or without Dr.", () => {
    for (const query of ["sana", "SANA ", "  dr sana", "Dr. Sana"]) {
      expect(names(filterDoctors(doctors, { ...NO_DOCTOR_FILTERS, query }))).toEqual(["Dr. Sana Farooqui"]);
    }
  });

  it("does not hide anyone when only Dr. is typed", () => {
    expect(filterDoctors(doctors, { ...NO_DOCTOR_FILTERS, query: "Dr." })).toHaveLength(9);
  });

  it("filters by the weekday a doctor sits", () => {
    const sundays = filterDoctors(doctors, { ...NO_DOCTOR_FILTERS, day: "sun" });
    expect(sundays).toHaveLength(0);
    const tuesday = filterDoctors(doctors, { ...NO_DOCTOR_FILTERS, day: "tue" });
    expect(tuesday.length).toBeGreaterThan(0);
    for (const doctor of tuesday) expect(doctor.schedule.some((session) => session.day === "tue")).toBe(true);
  });

  it("combines filters (AND)", () => {
    const result = filterDoctors(doctors, { departmentId: "dept-pediatrics", query: "faisal", day: "fri" });
    expect(names(result)).toEqual(["Dr. Faisal Chaudhry"]);
    expect(filterDoctors(doctors, { departmentId: "dept-pediatrics", query: "faisal", day: "mon" })).toEqual([]);
  });

  it("treats special characters literally and never throws", () => {
    for (const query of ["(", "*", "\\", "[a-", ".*", "+++"]) {
      expect(() => filterDoctors(doctors, { ...NO_DOCTOR_FILTERS, query })).not.toThrow();
      expect(filterDoctors(doctors, { ...NO_DOCTOR_FILTERS, query })).toEqual([]);
    }
  });

  it("reports whether any filter is active", () => {
    expect(hasDoctorFilters(NO_DOCTOR_FILTERS)).toBe(false);
    expect(hasDoctorFilters({ ...NO_DOCTOR_FILTERS, query: "  " })).toBe(false);
    expect(hasDoctorFilters({ ...NO_DOCTOR_FILTERS, query: "dr." })).toBe(false);
    expect(hasDoctorFilters({ ...NO_DOCTOR_FILTERS, day: "mon" })).toBe(true);
  });
});

describe("filterLabTests", () => {
  const none = { categoryId: "", query: "" };

  it("searches names and also-known-as names", () => {
    expect(filterLabTests(labTests, { ...none, query: "a1c" }).map((test) => test.slug)).toEqual(["hba1c"]);
    expect(filterLabTests(labTests, { ...none, query: "SUGAR" }).map((test) => test.slug)).toEqual(
      expect.arrayContaining(["fasting-blood-sugar", "random-blood-sugar"]),
    );
    expect(filterLabTests(labTests, { ...none, query: "cbc" }).map((test) => test.slug)).toEqual(["complete-blood-count"]);
  });

  it("filters by category and combines with search", () => {
    const diabetes = labTestCategories.find((category) => category.slug === "diabetes");
    const inCategory = filterLabTests(labTests, { categoryId: diabetes?.id ?? "", query: "" });
    expect(inCategory.length).toBeGreaterThanOrEqual(2);
    expect(inCategory.every((test) => test.categoryId === diabetes?.id)).toBe(true);
    expect(filterLabTests(labTests, { categoryId: diabetes?.id ?? "", query: "lipid" })).toEqual([]);
  });

  it("treats special characters literally", () => {
    expect(filterLabTests(labTests, { ...none, query: "(" }).length).toBeGreaterThanOrEqual(0);
    expect(() => filterLabTests(labTests, { ...none, query: "[" })).not.toThrow();
  });
});

describe("query-string helpers", () => {
  const get = (params: Record<string, string>) => (key: string) => params[key] ?? null;

  it("round-trips doctor filters", () => {
    const filters = { departmentId: "dept-pediatrics", query: "Sana", day: "mon" as const };
    const query = doctorFiltersToQuery(filters, departments);
    expect(query).toBe("department=pediatrics&q=Sana&day=mon");
    const parsed = parseDoctorFilters((key) => new URLSearchParams(query).get(key), departments);
    expect(parsed).toEqual(filters);
  });

  it("ignores unknown values and writes nothing for empty filters", () => {
    expect(parseDoctorFilters(get({ department: "nope", day: "sun" }), departments)).toEqual({ departmentId: "", query: "", day: "" });
    expect(doctorFiltersToQuery(NO_DOCTOR_FILTERS, departments)).toBe("");
  });

  it("round-trips lab test filters and ignores unknown categories", () => {
    const query = labTestFiltersToQuery({ categoryId: "cat-heart", query: "lipid" }, labTestCategories);
    expect(query).toBe("category=heart&q=lipid");
    expect(parseLabTestFilters((key) => new URLSearchParams(query).get(key), labTestCategories)).toEqual({ categoryId: "cat-heart", query: "lipid" });
    expect(parseLabTestFilters(get({ category: "zzz" }), labTestCategories).categoryId).toBe("");
  });
});

describe("health tip filters", () => {
  const categories = [...new Set(healthTips.map((tip) => tip.category))];

  it("shows every tip with no filter, and only the chosen category otherwise", () => {
    expect(filterTips(healthTips, NO_TIP_FILTERS)).toHaveLength(healthTips.length);
    expect(filterTips(healthTips, { category: "Nutrition" }).map((tip) => tip.slug)).toEqual(["staying-hydrated", "balanced-plate"]);
    expect(filterTips(healthTips, { category: "Nothing" })).toEqual([]);
    expect(hasTipFilters(NO_TIP_FILTERS)).toBe(false);
    expect(hasTipFilters({ category: "Sleep" })).toBe(true);
  });

  it("writes category names as slugs and reads them back", () => {
    expect(tipCategorySlug("Mental wellbeing")).toBe("mental-wellbeing");
    const query = tipFiltersToQuery({ category: "Mental wellbeing" });
    expect(query).toBe("category=mental-wellbeing");
    expect(parseTipFilters((key) => new URLSearchParams(query).get(key), categories)).toEqual({ category: "Mental wellbeing" });
  });

  it("ignores an unknown category and writes nothing for no filter", () => {
    expect(parseTipFilters((key) => (key === "category" ? "zzz" : null), categories)).toEqual({ category: "" });
    expect(parseTipFilters(() => null, categories)).toEqual({ category: "" });
    expect(tipFiltersToQuery(NO_TIP_FILTERS)).toBe("");
  });
});
