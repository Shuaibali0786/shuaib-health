// Feature 013: the owner's real Chrome test (2026-11-09 morning, real microphone). Every string below is exactly what
// Chrome heard; each fixed behaviour is kept as a regression test.
import { describe, expect, it } from "vitest";

import { extractPhone, spokenDigits } from "@/voice/parse/phone";
import { greetingOnly } from "@/voice/router";

import { makeWorld } from "../voice/harness";

const HEARD = {
  full: "zero Thi two four five two double S Fa Ti Fa",
  run: "Z T2 Ffa2d6353",
  short: "Z T four Faio2d6",
  doubled: "zero zero three two four Faio2don",
} as const;

/** A booking with Dr. Bilal up to the mobile-number question. */
async function atPhone(lang: "en" | "roman" = "roman") {
  const w = makeWorld({ lang });
  for (const t of ["Dr Bilal se appointment chahiye", "jumma ko", "11:30", "mera naam Ali Raza hai"]) await w.say(t);
  expect(w.ctx.booking?.asking).toBe("phone");
  return w;
}

describe("1. phone number by voice", () => {
  it("maps English mishearings and Urdu digit words while the number is asked", () => {
    const cases: Array<[string, string]> = [
      ["zero Z sifar", "000"],
      ["one won ek", "111"],
      ["two to too tu do", "22222"],
      ["three thi tree ti teen", "33333"],
      ["four for fore char chaar", "44444"],
      ["five fa faio faiv fife paanch", "555555"],
      ["six S siks sics chay chhe", "666666"],
      ["seven saat", "77"],
      ["eight ate aath", "888"],
      ["nine nain nau", "999"],
      ["double five", "55"],
      ["triple seven", "777"],
      ["double S", "66"],
    ];
    for (const [said, digits] of cases) expect(spokenDigits(said, { fuzzy: true }), said).toBe(digits);
  });

  it("does not turn everyday words into digits outside a number", () => {
    expect(spokenDigits("number bata do", { fuzzy: true })).toBe("");
    expect(spokenDigits("I want to book for Monday", { fuzzy: true })).toBe("");
    // The strict reading (used outside the phone question) is unchanged.
    expect(spokenDigits("I want to book for Monday")).toBe("");
  });

  it("reads the owner's exact misheard strings", () => {
    expect(extractPhone(HEARD.full, "", { fuzzy: true })).toEqual({ status: "complete", e164: "+923245266535" });
    expect(extractPhone(HEARD.run, "", { fuzzy: true })).toEqual({ status: "partial", digits: "032526353" });
    expect(extractPhone(HEARD.short, "", { fuzzy: true })).toEqual({ status: "partial", digits: "034526" });
    // "0032…" can never begin a mobile number: wrong, not kept to pile the next try onto.
    expect(extractPhone(HEARD.doubled, "", { fuzzy: true })).toEqual({ status: "invalid", digits: "0032452" });
  });

  it("a new try or 'phir se' replaces the partial number instead of piling up ('0032 40245')", () => {
    expect(extractPhone("zero three two four", "0324", { fuzzy: true })).toEqual({ status: "partial", digits: "0324" });
    expect(extractPhone("phir se three two four", "0324", { fuzzy: true })).toEqual({ status: "partial", digits: "324" });
    expect(extractPhone("five two six six five three five", "0324", { fuzzy: true })).toEqual({ status: "complete", e164: "+923245266535" });
    expect(extractPhone("four zero two four five", "0032", { fuzzy: true }).status).not.toBe("complete");
  });

  it("the full misheard number is accepted in the conversation", async () => {
    const w = await atPhone();
    const out = await w.say(HEARD.full);
    expect(w.ctx.booking?.draft.phone).toBe("+923245266535");
    expect(out.text).toContain("email");
  });

  it("the mobile question offers the typed field and says both ways", async () => {
    const w = makeWorld({ lang: "roman" });
    let out = await w.say("Dr Bilal se appointment chahiye");
    for (const t of ["jumma ko", "11:30"]) out = await w.say(t);
    out = await w.say("mera naam Ali Raza hai");
    expect(out.input).toBe("phone");
    expect(out.text).toContain("Aap number bol sakte hain ya neeche likh bhi sakte hain.");
  });

  it("a first part is read back and the patient goes on (owner rule A6); a wrong number is read back ONCE, then the field, never a third ask", async () => {
    const w = await atPhone();
    const part = await w.say(HEARD.run);
    expect(part.text).toContain("0325 263 53");
    expect(part.text).toContain("aage bataiye");
    expect(part.input).toBe("phone");

    // The rest makes the number too long: what was heard is read back once, with the rule.
    const first = await w.say("one two three four five");
    expect(first.text).toContain("suna");
    expect(first.text).toContain("11 digits");
    expect(first.input).toBe("phone");
    expect(first.options ?? []).toEqual([]);

    // Nothing usable heard a second time: the calm way through is the box (not another "say it again").
    const second = await w.say("hmm hmm");
    expect(second.text).not.toMatch(/suna\./);
    expect(second.text).toContain("neeche box mein likh");
    expect(second.input).toBe("phone");

    const third = await w.say("umm");
    expect(third.text).not.toMatch(/suna\./);
    expect(third.text).not.toMatch(/dobara|bol dein/i);
    expect(third.input).toBe("phone");
    expect(third.options ?? []).toEqual([]);

    // The typed field sends the digits as one turn.
    const typed = await w.say("03245266535");
    expect(w.ctx.booking?.draft.phone).toBe("+923245266535");
    expect(typed.text).toContain("email");
    expect(typed.input).toBeUndefined();
  });

  it("'phir se' clears the partial number in the conversation", async () => {
    const w = await atPhone();
    await w.say("zero three two four");
    expect(w.ctx.booking?.draft.phonePartial).toBe("0324");
    await w.say("phir se");
    expect(w.ctx.booking?.draft.phonePartial).toBe("");
  });

  it("works in English too", async () => {
    const w = makeWorld({ lang: "en" });
    for (const t of ["book an appointment with Dr Bilal", "tuesday", "10"]) await w.say(t);
    const ask = await w.say("Sara Noor");
    expect(ask.text).toContain("You can say the number or type it below.");
    const out = await w.say(HEARD.run);
    expect(out.text).toContain("0325 263 53. Got it, please go on.");
    expect(out.input).toBe("phone");
  });
});

describe("2. memory: a doctor already named is kept", () => {
  const cases: string[][] = [
    ["Omar Sheikh", "booking karo"],
    ["Omar Sheikh", "unki fee kitni hai", "booking karo"],
    ["Dr Omar Sheikh", "nahi", "booking karo"],
    ["Omar Sheikh", "booking karo bukhar hai"],
    ["good morning", "Omar Sheikh", "Clinic kab khulta hai", "booking karo"],
  ];
  for (const turns of cases) {
    it(turns.join(" -> "), async () => {
      const w = makeWorld({ lang: "roman" });
      let out;
      for (const t of turns) out = await w.say(t);
      expect(w.ctx.booking?.draft.doctorSlug).toBe("dr-omar-sheikh");
      expect(out?.text).not.toMatch(/kis doctor|Kaun se doctor|Which doctor/i);
    });
  }

  it("a different department named with the booking wins over the remembered doctor", async () => {
    const w = makeWorld({ lang: "roman" });
    for (const t of ["Omar Sheikh", "nahi", "daant ki booking karo"]) await w.say(t);
    expect(w.ctx.booking?.draft.departmentSlug).toBe("dental");
  });
});

describe("3. greetings", () => {
  const cases: Array<[string, RegExp]> = [
    ["good morning", /^Good morning!/],
    ["good mroning", /^Good morning!/],
    ["Good evening", /^Good evening!/],
    ["good afternoon", /^Good afternoon!/],
    ["salam", /^Wa alaikum assalam!/],
    ["AOA", /^Wa alaikum assalam!/],
    ["Good morning ji", /^Good morning!/],
  ];
  for (const [said, back] of cases) {
    it(`"${said}" is greeted back warmly`, async () => {
      const w = makeWorld();
      const out = await w.say(said);
      expect(out.intent).toBe("greeting");
      expect(out.text).toMatch(back);
      expect(out.text).not.toMatch(/what the problem is|takleef kya hai/i);
    });
  }

  it("a greeting with a problem in it is not only a greeting", () => {
    expect(greetingOnly("good morning mujhe bukhar hai")).toBe(false);
    expect(greetingOnly("good mroning")).toBe(true);
  });
});
