import { describe, expect, it } from "vitest";

import { parseDate, speakDate, speakTime, todayLocal } from "@/voice/parse/date";
import { cleanReason, declines, extractEmail, extractName } from "@/voice/parse/name";
import { extractPhone, spokenDigits } from "@/voice/parse/phone";
import { parseTimes } from "@/voice/parse/time";
import { parseYesNo } from "@/voice/parse/yesno";

// Sunday 8 November 2026, 15:00 in Karachi (10:00 UTC).
const NOW = new Date("2026-11-08T10:00:00Z");

describe("yes / no (FR-045: only a clear yes counts)", () => {
  it.each(["yes", "Yes!", "yes please", "yeah", "confirm", "haan", "ji haan", "haan, kar dein", "bilkul", "theek hai", "yes I confirm", "sure", "correct"])("%s is a yes", (t) => {
    expect(parseYesNo(t)).toBe("yes");
  });
  it.each(["ok", "okay", "ji", "hmm", "yes but change the date", "yes wait", "haan lekin time badal dein", "maybe", "shayad", "yes no", "", "um yes", "yes yes yes yes yes yes yes yes yes", "what did you say", "please"])("%s is NOT a yes", (t) => {
    expect(parseYesNo(t)).not.toBe("yes");
  });
  it.each(["no", "nahi", "nope", "no thanks", "galat hai"])("%s is a no", (t) => {
    expect(parseYesNo(t)).toBe("no");
  });
});

describe("spoken phone numbers", () => {
  it("reads digits, digit words, double and triple", () => {
    expect(spokenDigits("zero three zero zero one two three four five six seven")).toBe("03001234567");
    expect(spokenDigits("0300 double five one two three four five")).toBe("0300551234" + "5");
    expect(spokenDigits("sifar teen sifar sifar triple five")).toBe("0300555");
  });
  it("completes a valid mobile and normalises it", () => {
    expect(extractPhone("zero three zero zero one two three four five six seven")).toEqual({ status: "complete", e164: "+923001234567" });
    expect(extractPhone("my number is 0300-1234567")).toEqual({ status: "complete", e164: "+923001234567" });
    expect(extractPhone("plus nine two three zero zero one two three four five six seven")).toEqual({ status: "complete", e164: "+923001234567" });
  });
  it("keeps a partial number and asks only for the rest", () => {
    const first = extractPhone("zero three zero zero one two three");
    expect(first).toEqual({ status: "partial", digits: "0300123" });
    expect(extractPhone("four five six seven", "0300123")).toEqual({ status: "complete", e164: "+923001234567" });
  });
  it("a fresh number replaces the partial one", () => {
    expect(extractPhone("03111234567", "0300123")).toEqual({ status: "complete", e164: "+923111234567" });
  });
  it("rejects a full-length number that is not a mobile", () => {
    expect(extractPhone("0421234567890").status).toBe("invalid");
    expect(extractPhone("hello there").status).toBe("none");
  });
});

describe("spoken dates", () => {
  it("today, tomorrow, the day after, in English and Roman Urdu", () => {
    expect(todayLocal(NOW)).toBe("2026-11-08");
    expect(parseDate("today", NOW)).toBe("2026-11-08");
    expect(parseDate("kal subah", NOW)).toBe("2026-11-09");
    expect(parseDate("parson", NOW)).toBe("2026-11-10");
    expect(parseDate("day after tomorrow", NOW)).toBe("2026-11-10");
  });
  it("uses the clinic's calendar day, not UTC (19:30 UTC is already the next day in Karachi)", () => {
    expect(todayLocal(new Date("2026-11-08T19:30:00Z"))).toBe("2026-11-09");
  });
  it("weekdays mean the next one", () => {
    expect(parseDate("friday", NOW)).toBe("2026-11-13");
    expect(parseDate("next monday", NOW)).toBe("2026-11-09");
    expect(parseDate("jumma ko", NOW)).toBe("2026-11-13");
    expect(parseDate("sunday", NOW)).toBe("2026-11-15");
  });
  it("day of the month with an ordinal, a month, or tareekh", () => {
    expect(parseDate("the 13th", NOW)).toBe("2026-11-13");
    expect(parseDate("13 november", NOW)).toBe("2026-11-13");
    expect(parseDate("november 20", NOW)).toBe("2026-11-20");
    expect(parseDate("13 tareekh", NOW)).toBe("2026-11-13");
    expect(parseDate("5th", NOW)).toBe("2026-12-05"); // 5 November has passed
    expect(parseDate("3 january", NOW)).toBe("2027-01-03");
  });
  it("a bare number is a date only when the date was just asked", () => {
    expect(parseDate("13", NOW)).toBeNull();
    expect(parseDate("13", NOW, true)).toBe("2026-11-13");
    expect(parseDate("11 baje", NOW)).toBeNull();
  });
  it("says dates and times in full", () => {
    expect(speakDate("2026-11-13")).toBe("Friday 13 November");
    expect(speakTime("11:30")).toBe("11:30 AM");
    expect(speakTime("15:00")).toBe("3:00 PM");
    expect(speakTime("12:15")).toBe("12:15 PM");
  });
});

describe("spoken times", () => {
  it("reads clock times and markers", () => {
    expect(parseTimes("11:30")).toEqual(["11:30", "23:30"]);
    expect(parseTimes("11:30 am")).toEqual(["11:30"]);
    expect(parseTimes("3 pm")).toEqual(["15:00"]);
    expect(parseTimes("2 baje dopahar")).toEqual(["14:00"]);
    expect(parseTimes("subah 10 baje")).toEqual(["10:00"]);
    expect(parseTimes("14:15")).toEqual(["14:15"]);
  });
  it("reads Roman Urdu number words and fractions", () => {
    expect(parseTimes("teen baje")).toEqual(["03:00", "15:00"]);
    expect(parseTimes("saade gyarah")).toEqual(["11:30", "23:30"]);
    expect(parseTimes("sawa do baje")).toEqual(["02:15", "14:15"]);
    expect(parseTimes("paune das")).toEqual(["09:45", "21:45"]);
    expect(parseTimes("dhai baje")).toEqual(["02:30", "14:30"]);
  });
  it("reads English words and fractions", () => {
    expect(parseTimes("half past ten")).toEqual(["10:30", "22:30"]);
    expect(parseTimes("quarter to four pm")).toEqual(["15:45"]);
    expect(parseTimes("eleven thirty")).toEqual(["11:30", "23:30"]);
    expect(parseTimes("at 5")).toEqual(["05:00", "17:00"]);
  });
  it("a bare number is a time only when the time was just asked; nothing else matches", () => {
    expect(parseTimes("11")).toEqual([]);
    expect(parseTimes("11", true)).toEqual(["11:00", "23:00"]);
    expect(parseTimes("my phone is 0300")).toEqual([]);
    expect(parseTimes("what are the timings")).toEqual([]);
  });
});

describe("names, emails and reasons", () => {
  it("takes a name from an introduction, in English and Roman Urdu", () => {
    expect(extractName("my name is ali raza", false)).toBe("Ali Raza");
    expect(extractName("mera naam Ayesha Khan hai", false)).toBe("Ayesha Khan");
    expect(extractName("I'm Sara", false)).toBe("Sara");
  });
  it("takes a bare name only when the name was just asked", () => {
    expect(extractName("Ali Raza", true)).toBe("Ali Raza");
    expect(extractName("ji Ali Raza", true)).toBe("Ali Raza");
    expect(extractName("Ali Raza", false)).toBeNull();
  });
  it("refuses digits and symbols in a name", () => {
    expect(extractName("my name is ali123", false)).toBeNull();
    expect(extractName("<script>", true)).toBeNull();
  });
  it("reads a spoken email", () => {
    expect(extractEmail("ali dot raza at gmail dot com")).toBe("ali.raza@gmail.com");
    expect(extractEmail("ali underscore raza at the rate gmail dot com")).toBe("ali_raza@gmail.com");
    expect(extractEmail("it is Ali.Raza@Example.com thanks")).toBe("ali.raza@example.com");
    expect(extractEmail("I have no email")).toBeNull();
  });
  it("recognises 'skip' for optional answers and trims a reason", () => {
    expect(declines("nahi")).toBe(true);
    expect(declines("skip")).toBe(true);
    expect(declines("my email is x")).toBe(false);
    expect(cleanReason("  skin   allergy  ")).toBe("skin allergy");
    expect(cleanReason("x".repeat(400))?.length).toBe(300);
  });
});
