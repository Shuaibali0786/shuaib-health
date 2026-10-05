import { describe, expect, it } from "vitest";

import { parseFlowParams, serializeFlowParams, type FlowCatalog } from "@/lib/booking/flowUrl";

const catalog: FlowCatalog = {
  departments: [
    { id: "d1", slug: "cardiology" },
    { id: "d2", slug: "pediatrics" },
  ],
  doctors: [
    { slug: "dr-imran-qureshi", departmentId: "d1" },
    { slug: "dr-sana-farooqui", departmentId: "d2" },
  ],
};

const parse = (query: string) => parseFlowParams(new URLSearchParams(query), catalog);

describe("parseFlowParams", () => {
  it("starts at the department step with nothing chosen", () => {
    expect(parse("")).toEqual({ step: "department" });
  });

  it("derives the deepest valid step from what is chosen", () => {
    expect(parse("department=cardiology").step).toBe("doctor");
    expect(parse("department=cardiology&doctor=dr-imran-qureshi").step).toBe("date");
    expect(parse("department=cardiology&doctor=dr-imran-qureshi&date=2026-10-06").step).toBe("time");
    expect(parse("department=cardiology&doctor=dr-imran-qureshi&date=2026-10-06&time=14:00").step).toBe("details");
  });

  it("fills in the department from a doctor-only link", () => {
    expect(parse("doctor=dr-sana-farooqui")).toEqual({ department: "pediatrics", doctor: "dr-sana-farooqui", step: "date" });
  });

  it("drops a doctor that is not in the catalog or not in the chosen department", () => {
    expect(parse("doctor=dr-nobody")).toEqual({ step: "department" });
    expect(parse("department=cardiology&doctor=dr-sana-farooqui")).toEqual({ department: "cardiology", step: "doctor" });
  });

  it("drops an unknown department", () => {
    expect(parse("department=astrology")).toEqual({ step: "department" });
  });

  it("drops a malformed or impossible date and everything after it", () => {
    const base = "department=cardiology&doctor=dr-imran-qureshi";
    for (const date of ["tomorrow", "2026-13-01", "2026-02-30", "26-10-06", ""]) {
      expect(parse(`${base}&date=${date}&time=14:00`), date).toEqual({ department: "cardiology", doctor: "dr-imran-qureshi", step: "date" });
    }
  });

  it("drops a malformed time", () => {
    const base = "department=cardiology&doctor=dr-imran-qureshi&date=2026-10-06";
    for (const time of ["25:00", "9:00", "14:60", "noon", ""]) {
      expect(parse(`${base}&time=${time}`), time).toEqual({
        department: "cardiology",
        doctor: "dr-imran-qureshi",
        date: "2026-10-06",
        step: "time",
      });
    }
  });

  it("ignores a date without a doctor, and a time without a date", () => {
    expect(parse("date=2026-10-06&time=14:00")).toEqual({ step: "department" });
    expect(parse("department=cardiology&doctor=dr-imran-qureshi&time=14:00").step).toBe("date");
  });

  it("honours an earlier step (Back) but never a deeper one than the choices allow", () => {
    const full = "department=cardiology&doctor=dr-imran-qureshi&date=2026-10-06&time=14:00";
    expect(parse(`${full}&step=time`).step).toBe("time");
    expect(parse(`${full}&step=doctor`).step).toBe("doctor");
    expect(parse("department=cardiology&step=details").step).toBe("doctor");
    expect(parse(`${full}&step=nonsense`).step).toBe("details");
  });

  it("keeps the choices when an earlier step is shown", () => {
    const parsed = parse("department=cardiology&doctor=dr-imran-qureshi&date=2026-10-06&time=14:00&step=date");
    expect(parsed).toEqual({ department: "cardiology", doctor: "dr-imran-qureshi", date: "2026-10-06", time: "14:00", step: "date" });
  });

  it("ignores every other key, including anything that looks personal", () => {
    const parsed = parse("name=Ali&mobile=0300&email=a@b.c&department=cardiology");
    expect(parsed).toEqual({ department: "cardiology", step: "doctor" });
  });
});

describe("serializeFlowParams", () => {
  it("writes only slugs, a date, a time and the step, in a fixed order", () => {
    expect(serializeFlowParams({ step: "details", time: "14:00", date: "2026-10-06", doctor: "dr-imran-qureshi", department: "cardiology" })).toBe(
      "?department=cardiology&doctor=dr-imran-qureshi&date=2026-10-06&time=14:00&step=details",
    );
  });

  it("writes only the step when nothing is chosen", () => {
    expect(serializeFlowParams({ step: "department" })).toBe("?step=department");
  });

  it("round-trips through parse", () => {
    const params = parse("department=cardiology&doctor=dr-imran-qureshi&date=2026-10-06&step=time");
    expect(parse(serializeFlowParams(params).slice(1))).toEqual(params);
  });

  it("never emits another key", () => {
    const query = serializeFlowParams({ step: "time", department: "cardiology", doctor: "dr-imran-qureshi", date: "2026-10-06", fullName: "Ali" } as never);
    const keys = [...new URLSearchParams(query).keys()];
    expect(keys.every((key) => ["department", "doctor", "date", "time", "step"].includes(key))).toBe(true);
    expect(query).not.toContain("Ali");
  });
});
