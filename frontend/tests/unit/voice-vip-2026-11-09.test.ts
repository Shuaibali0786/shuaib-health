// Feature 013, owner request 2026-11-09 (VIP final check): every Part A / Part B fix, with the owner's own words.
import { describe, expect, it } from "vitest";

import { findDepartment, findDoctors, soundKey } from "@/voice/entities";
import { groupReference, speakReference } from "@/voice/chunk";
import { replyLanguage, requestedLanguage, urduToLatin } from "@/voice/language";
import { confirmsSpelling, extractName } from "@/voice/parse/name";
import { extractPhone, spokenDigits } from "@/voice/parse/phone";
import { parseTimes, withoutDates } from "@/voice/parse/time";
import { welcomeLine } from "@/voice/phrases";
import { forSpeech, pronounce } from "@/voice/speechText";

import { makeWorld, packFor } from "../voice/harness";

const pack = packFor(false);

describe("A1 greeting: English first, warm, says she can use English or Urdu", () => {
  it("is the owner's line, in English", () => {
    expect(welcomeLine(pack, "en")).toBe("Hello, welcome to Shuaib Health. I'm Ayesha, the clinic's assistant. I can help you in English or Urdu. How can I help you today?");
  });
});

describe("B2: the time the patient said is the time booked, never changed silently", () => {
  it("'13 november 2 pm' is 2:00 PM, not 1:00 PM (the 13 is the date)", () => {
    expect(parseTimes("13 november 2 pm")).toEqual(["14:00"]);
    expect(parseTimes("friday the 13th at 11")).toEqual(["11:00", "23:00"]);
    expect(withoutDates("13 november 2 pm")).toBe("2 pm");
    expect(withoutDates("november 13th 3 baje")).toBe("3 baje");
  });

  it("books exactly 2:00 PM when it is free", async () => {
    const w = makeWorld();
    await w.say("book an appointment with Dr Maryam");
    await w.say("13 november 2 pm");
    expect(w.ctx.booking?.draft.time).toBe("14:00");
  });

  it("a time that is not free: says so, offers the nearest REAL times as choices, and waits", async () => {
    const w = makeWorld();
    await w.say("book an appointment with Dr Maryam");
    const out = await w.say("13 november 1 pm");
    expect(out.text).toMatch(/^1:00 PM isn't available on Friday 13 November\. The nearest times are .+\. Which would you like\?$/);
    expect(out.options?.length).toBeGreaterThan(0);
    expect(w.ctx.booking?.draft.time).toBeNull();
    expect(w.ctx.booking?.asking).toBe("time");
    // The patient chooses one of the offered times.
    const chosen = out.options?.[0] as string;
    await w.say(chosen);
    expect(w.ctx.booking?.draft.startsAt).not.toBeNull();
  });
});

describe("B3: confirmation words are never saved as a name", () => {
  it.each(["Aspilng sahi hai", "spelling sahi hai", "sahi hai", "yes correct", "haan ji", "theek hai", "okay", "ispelling theek hai"])("'%s' is not a name", (said) => {
    expect(extractName(said, true)).toBeNull();
  });
  it.each(["Aspilng sahi hai", "spelling sahi hai", "yes", "haan", "ji", "correct", "that's right", "theek hai"])("'%s' confirms the spelling", (said) => {
    expect(confirmsSpelling(said)).toBe(true);
  });
  it.each(["no", "nahi galat hai", "wrong", "not right"])("'%s' does not", (said) => {
    expect(confirmsSpelling(said)).toBe(false);
  });
  it("at the spelling check, 'Aspilng sahi hai' keeps the name and moves on", async () => {
    const w = makeWorld();
    for (const t of ["book an appointment with Dr Bilal", "monday", "10"]) await w.say(t);
    await w.say("my name is Ali Raza", { spoken: true });
    expect(w.ctx.booking?.asking).toBe("nameCheck");
    await w.say("Aspilng sahi hai", { spoken: true });
    expect(w.ctx.booking?.draft.fullName).toBe("Ali Raza");
    expect(w.ctx.booking?.asking).toBe("phone");
  });
});

describe("B4: any 2+ word name of letters is accepted; one re-ask, then the name box", () => {
  it.each([["Ali test", "Ali Test"], ["my name is Ali test", "Ali Test"], ["Sana Clinic Khan", "Sana Clinic Khan"]])("'%s' -> %s", (said, name) => {
    expect(extractName(said, true)).toBe(name);
  });
  it("an unclear name: one calm re-ask with the box, then only the box", async () => {
    const w = makeWorld();
    for (const t of ["book an appointment with Dr Bilal", "monday", "10"]) await w.say(t);
    const first = await w.say("hmm");
    expect(first.text).toContain("Sorry, I didn't catch your name");
    expect(first.input).toBe("name");
    const second = await w.say("umm");
    expect(second.text).toContain("Please type your name in the box below");
    expect(second.input).toBe("name");
  });
});

describe("B5 / A2: the language follows the patient and never flips on one word", () => {
  it.each([
    ["darm Hai Thoda ji", "en", "en"],
    ["Dermatology", "en", "en"],
    ["yes", "en", "en"],
    ["Aspilng sahi hai", "en", "en"],
    ["mujhe bukhar hai", "en", "roman"],
    ["booking karo", "en", "roman"],
    ["What are your timings today?", "roman", "en"],
    ["Ali Raza", "roman", "roman"],
  ] as const)("'%s' (call in %s) -> %s", (said, previous, expected) => {
    expect(replyLanguage(said, previous)).toBe(expected);
  });
  it("'English please' locks English for the rest of the call, even after clear Urdu", async () => {
    const w = makeWorld({ lang: "roman" });
    expect(requestedLanguage("English please")).toBe("en");
    const out = await w.say("English please");
    expect(out.text).toMatch(/^Of course, I'll continue in English\./);
    const later = await w.say("mujhe bukhar hai");
    expect(later.lang).toBe("en");
  });
  it("the owner's call: English, then 'darm Hai Thoda ji', 'Dermatology', 'yes' all stay English", async () => {
    const w = makeWorld();
    await w.say("I need to see a doctor for my skin");
    for (const t of ["darm Hai Thoda ji", "Dermatology", "yes"]) expect((await w.say(t)).lang).toBe("en");
  });
});

describe("B6: misheard department, doctor and test names are understood", () => {
  it.each(["Drmitoloji", "dermitology", "darm", "dermatologist", "darmatology"])("'%s' -> Dermatology", (said) => {
    expect(findDepartment(said, pack)).toBe("dermatology");
  });
  it.each([["cardiolgy", "cardiology"], ["pedeatric", "pediatrics"], ["dentel", "dental"], ["gaynee doctor", "gynecology"]])("'%s' -> %s", (said, slug) => {
    expect(findDepartment(said, pack)).toBe(slug);
  });
  it("sound keys", () => {
    expect(soundKey("dermatology")).toBe(soundKey("drmitoloji"));
  });
  it("doctor names said differently", () => {
    expect(findDoctors("Dr Mariam", pack).map((d) => d.slug)).toEqual(["dr-maryam-baloch"]);
    expect(findDoctors("Dr Zenab Memon", pack).map((d) => d.slug)).toEqual(["dr-zainab-memon"]);
  });
});

describe("B7: the reference is exactly like the slip, read in two slow groups", () => {
  it("XP75N-MYDWQ", () => {
    expect(groupReference("XP75N-MYDWQ")).toBe("XP75N-MYDWQ");
    expect(groupReference("xp75nmydwq")).toBe("XP75N-MYDWQ");
    expect(speakReference("XP75N-MYDWQ")).toBe("X, P, 7, 5, N. Then, M, Y, D, W, Q");
  });
});

describe("B9: names are pronounced right, only in speech", () => {
  it("Ayesha, Shuaib, Maryam, Zainab, Baloch, Memon", () => {
    expect(pronounce("I'm Ayesha.")).toBe("I'm Aa-ee-sha.");
    expect(pronounce("Welcome to Shuaib Health.")).toBe("Welcome to Shoo-aib Health.");
    expect(pronounce("Dr. Maryam Baloch and Dr. Zainab Memon")).toBe("Dr. Mar-yam Ba-loach and Dr. Zay-nab May-mon");
    // The screen text is never changed by the speech rewriting itself.
    expect(forSpeech("I'm Ayesha.")).toBe("I'm Ayesha.");
  });
});

describe("A4: a problem -> the department -> its doctors with days, hours and fee -> WAIT for the patient's choice", () => {
  it("'I have an allergy, can you treat it?' lists Dr. Maryam Baloch with days, hours and fee and asks; nothing booked yet", async () => {
    const w = makeWorld();
    const out = await w.say("I have an allergy, can you treat it?");
    expect(out.text).toMatch(/^I(?:'m sorry you're| understand)[^.]*\. Yes, we can help/);
    expect(out.text).toMatch(/Dr\. Maryam Baloch in Dermatology\. The doctor is available Monday, Wednesday and Friday, \d+ (AM|PM) to \d+ (AM|PM), and the fee is PKR 3,000\. Would you like to book with Dr\. Maryam Baloch\?$/);
    expect(w.ctx.booking).toBeNull();
    expect(out.text).not.toMatch(/afsos|diagnos/i);
  });
  it("'mujhe bukhar hai, ilaaj ho sakta hai?' lists both General Medicine doctors in Roman Urdu and asks which one", async () => {
    const w = makeWorld();
    const out = await w.say("mujhe bukhar hai, ilaaj ho sakta hai?");
    expect(out.lang).toBe("roman");
    expect(out.text).toMatch(/Dr\. Hassan Mirza: .+, fee PKR 2,000\. Dr\. Omar Sheikh: .+, fee PKR 1,800\. Aap kis doctor se milna chahenge\?$/);
    expect(out.options).toEqual(["Dr. Hassan Mirza", "Dr. Omar Sheikh"]);
    expect(w.ctx.booking).toBeNull();
  });
  it.each([["Dr Omar Sheikh", "dr-omar-sheikh"], ["the first one", "dr-hassan-mirza"], ["doosre wale", "dr-omar-sheikh"]])("the patient chooses '%s'", async (choice, slug) => {
    const w = makeWorld();
    await w.say("I have a fever");
    await w.say(choice);
    expect(w.ctx.booking?.draft.doctorSlug).toBe(slug);
  });
  it("an emergency still gives the emergency number first", async () => {
    const w = makeWorld();
    const out = await w.say("I have chest pain and I can't breathe");
    expect(out.text).toMatch(/1122/);
    expect(out.urgent).toBe(true);
  });
});

describe("A6: the mobile number, in parts, read back, then confirmed", () => {
  it.each([
    ["Z3001234fa Son", "0300123457"],
    ["Z T Ziroon234fa S A", "030234568"],
    ["zero three double two aik do teen char paanch chay", "0322123456"],
    ["sifar teen sifar sifar ek do teen char paanch chay saat", "03001234567"],
    ["ziro three triple four five six seven eight nine", "0344456789"],
  ])("'%s' -> %s", (said, digits) => {
    expect(spokenDigits(said, { fuzzy: true })).toBe(digits);
  });
  it("Urdu-script digits", () => {
    expect(extractPhone(urduToLatin("زیرو تھری زیرو زیرو ون ٹو تھری فور فائیو سکس سیون"), "", { fuzzy: true })).toEqual({ status: "complete", e164: "+923001234567" });
  });
  it("parts across turns are read back, then the whole number is confirmed once", async () => {
    const w = makeWorld();
    for (const t of ["book an appointment with Dr Bilal", "monday", "10", "Sara Noor"]) await w.say(t);
    const ask = await w.say("zero three two four", { spoken: true });
    expect(ask.text).toBe("0324. Got it, please go on.");
    await w.say("five two six", { spoken: true });
    const whole = await w.say("six five three five", { spoken: true });
    expect(whole.text).toBe("0324 526 6535. Is that right?");
    expect(whole.spoken).toContain("zero three two four");
    const yes = await w.say("yes", { spoken: true });
    expect(yes.text).toMatch(/email/);
    expect(w.ctx.booking?.draft.phone).toBe("+923245266535");
  });
  it("'no' at the number check asks again; a typed number is never read back", async () => {
    const w = makeWorld();
    for (const t of ["book an appointment with Dr Bilal", "monday", "10", "Sara Noor"]) await w.say(t);
    await w.say("zero three two four five two six six five three five", { spoken: true });
    const no = await w.say("no", { spoken: true });
    expect(w.ctx.booking?.draft.phone).toBeNull();
    expect(no.input).toBe("phone");
    const typed = await w.say("03245266535");
    expect(typed.text).toMatch(/email/);
  });
});
