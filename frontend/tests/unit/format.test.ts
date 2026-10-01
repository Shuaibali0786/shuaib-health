import { describe, expect, it } from "vitest";
import { siteConfig } from "@/data/siteConfig";
import { formatKarachiDate, formatOpeningHours, formatOpeningHoursParts, formatPkr } from "@/lib/format";
import type { OpeningHoursRule } from "@/types/content";

describe("formatPkr", () => {
  it("formats whole rupees with a thousands separator", () => {
    expect(formatPkr(2500)).toBe("PKR 2,500");
    expect(formatPkr(2000)).toBe("PKR 2,000");
    expect(formatPkr(1250000)).toBe("PKR 1,250,000");
    expect(formatPkr(0)).toBe("PKR 0");
  });

  it("rejects fractions and negatives instead of showing a wrong price", () => {
    expect(() => formatPkr(2500.5)).toThrow(RangeError);
    expect(() => formatPkr(-1)).toThrow(RangeError);
    expect(() => formatPkr(Number.NaN)).toThrow(RangeError);
  });
});

describe("formatKarachiDate", () => {
  it("formats a Karachi timestamp", () => {
    expect(formatKarachiDate("2026-09-12T09:00:00+05:00")).toBe("12 Sep 2026");
    expect(formatKarachiDate("2026-08-14T09:00:00+05:00")).toBe("14 Aug 2026");
  });

  it("uses the calendar date in Karachi, not in UTC", () => {
    // 20:00 UTC on 11 Sep is already 01:00 on 12 Sep in Karachi.
    expect(formatKarachiDate("2026-09-11T20:00:00Z")).toBe("12 Sep 2026");
    // 20:30 UTC on 31 Dec is already 1 Jan in Karachi.
    expect(formatKarachiDate("2026-12-31T20:30:00Z")).toBe("1 Jan 2027");
  });

  it("rejects text that is not a date", () => {
    expect(() => formatKarachiDate("last Tuesday")).toThrow(RangeError);
  });
});

describe("formatOpeningHours", () => {
  it("formats the sample hours and always ends with PKT", () => {
    expect(formatOpeningHours(siteConfig.openingHours)).toBe("Mon–Sat, 9 AM – 9 PM PKT");
  });

  it("splits days and times for layouts that show them apart", () => {
    expect(formatOpeningHoursParts(siteConfig.openingHours)).toEqual({ days: "Mon–Sat", times: "9 AM – 9 PM PKT" });
  });

  it("handles minutes, noon and midnight", () => {
    const rules: OpeningHoursRule[] = [{ days: ["mon", "tue", "wed"], opens: "09:30", closes: "12:00" }];
    expect(formatOpeningHours(rules)).toBe("Mon–Wed, 9:30 AM – 12 PM PKT");
    expect(formatOpeningHours([{ days: ["sun"], opens: "00:00", closes: "23:45" }])).toBe("Sun, 12 AM – 11:45 PM PKT");
  });

  it("lists separate days and joins several rules", () => {
    expect(formatOpeningHours([{ days: ["mon", "wed"], opens: "10:00", closes: "14:00" }])).toBe(
      "Mon, Wed, 10 AM – 2 PM PKT",
    );
    const rules: OpeningHoursRule[] = [
      { days: ["mon", "tue", "wed", "thu", "fri"], opens: "09:00", closes: "21:00" },
      { days: ["sat"], opens: "10:00", closes: "14:00" },
    ];
    expect(formatOpeningHours(rules)).toBe("Mon–Fri, 9 AM – 9 PM; Sat, 10 AM – 2 PM PKT");
  });

  it("rejects a malformed time", () => {
    expect(() => formatOpeningHours([{ days: ["mon"], opens: "25:00", closes: "26:00" }])).toThrow(RangeError);
  });
});
