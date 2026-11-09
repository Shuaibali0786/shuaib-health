// Feature 013, owner request 2026-11-09 (afternoon): a premium receptionist. Persona and small talk, calm words for an
// illness (never "afsos"), email by voice, the owner's yes words at the card, and the assistant's own name.
import { describe, expect, it } from "vitest";

import { extractEmail, spellEmail } from "@/voice/parse/name";
import { confirmsBooking, parseYesNo } from "@/voice/parse/yesno";
import { smallTalkOf } from "@/voice/router";

import { makeWorld } from "../voice/harness";

describe("small talk is answered like a person", () => {
  it.each([
    ["kaise hain aap", /Main bilkul theek hoon, shukriya! Aap sunaiye, main aap ki kya madad karoon\?/],
    ["aap kaisi ho", /Main bilkul theek hoon, shukriya!/],
    ["Assalam o Alaikum, kaise hain?", /^Wa alaikum assalam! Main bilkul theek hoon, shukriya!/],
    ["how are you?", /I'm doing great, thank you for asking! How can I help you today\?/],
    ["I'm fine, thank you. How are you?", /Glad to hear that! I'm doing great too, thank you\./],
    ["main theek hoon", /Sun kar khushi hui!/],
    ["good morning", /^Good morning!/],
    ["thank you Ayesha", /You're very welcome!/],
    ["shukriya", /Koi baat nahi, khushi hui!/],
    ["Allah Hafiz", /Allah Hafiz!/],
    ["bye", /goodbye|lovely day/i],
  ])("%s", async (said, reply) => {
    const w = makeWorld();
    const out = await w.say(said);
    expect(out.text).toMatch(reply);
    expect(out.text).not.toMatch(/didn't catch|samajh nahi|sun nahi saki|Maaf/i);
  });

  it("small talk with a problem in it is not small talk", () => {
    expect(smallTalkOf("main theek hoon, mujhe bukhar hai")).toBeNull();
    expect(smallTalkOf("how are you, I need a dentist")).toBeNull();
    expect(smallTalkOf("good doctor chahiye")).toBeNull();
  });

  it("'Assalam o alaikum, kaise hain, mujhe bukhar hai' answers the greeting, then the problem", async () => {
    const w = makeWorld();
    const out = await w.say("Assalam o alaikum, kaise hain, mujhe bukhar hai");
    expect(out.text).toMatch(/^Wa alaikum assalam! Main bilkul theek hoon, shukriya!/);
    expect(out.text).toContain("General Medicine");
  });

  it("'thank you' in the middle of a booking: a warm word, then the same question", async () => {
    const w = makeWorld();
    await w.say("book an appointment with Dr Bilal");
    const out = await w.say("thank you");
    expect(out.text).toMatch(/^You're very welcome! .*day/);
    expect(w.ctx.booking?.asking).toBe("date");
  });
});

describe("an illness gets calm, reassuring words (never 'afsos')", () => {
  it.each(["mujhe bukhar hai", "mere daant mein dard hai", "mujhe allergy hai", "mera BP high rehta hai", "mere bache ko khansi hai"])("%s", async (said) => {
    const w = makeWorld({ lang: "roman" });
    const out = await w.say(said);
    expect(out.text).not.toMatch(/afsos/i);
    expect(out.text).toMatch(/fikar na karein|samajh gayi/);
  });

  it("in English: no 'sorry to hear that', a reassuring line instead", async () => {
    const w = makeWorld();
    const out = await w.say("I have a fever");
    expect(out.text).not.toMatch(/sorry to hear/i);
    expect(out.text).toMatch(/not feeling well|right away|right doctor/);
  });
});

describe("email by voice", () => {
  it.each([
    ["Sohail gmail dot com", "sohail@gmail.com"],
    ["sohail at the rate gmail dot com", "sohail@gmail.com"],
    ["sohail khan at gmail", "sohailkhan@gmail.com"],
    ["suhail ka email gmail", "suhail@gmail.com"],
    ["mera email sohail at gmail dot com hai", "sohail@gmail.com"],
    ["my email is ali dot raza at yahoo dot com", "ali.raza@yahoo.com"],
    ["sohail123 at hotmail", "sohail123@hotmail.com"],
    ["sohail@gmail.com", "sohail@gmail.com"],
  ])("'%s' -> %s (when the email is asked)", (said, email) => {
    expect(extractEmail(said, true)).toBe(email);
  });

  it("outside the email question a provider alone is not an email", () => {
    expect(extractEmail("kya slip gmail pe aa sakti hai")).toBeNull();
  });

  it("is read back letter by letter for the name part", () => {
    expect(spellEmail("sohail@gmail.com")).toBe("s-o-h-a-i-l at gmail dot com");
    expect(spellEmail("ali.raza@gmail.com")).toBe("a-l-i dot r-a-z-a at gmail dot com");
    expect(spellEmail("sohail@gmail.com", true)).toBe("s, o, h, a, i, l, at gmail dot com");
  });

  async function atEmail(lang: "en" | "roman" = "roman") {
    const w = makeWorld({ lang });
    const open = lang === "roman" ? "Dr Bilal se appointment chahiye" : "book an appointment with Dr Bilal";
    for (const t of [open, "monday", "10", "Sara Noor", "03111234567"]) await w.say(t);
    expect(w.ctx.booking?.asking).toBe("email");
    return w;
  }

  it("'Sohail gmail dot com' -> 'Aap ki email s-o-h-a-i-l at gmail dot com, sahi hai?' -> 'ji' -> the card", async () => {
    const w = await atEmail();
    const out = await w.say("Sohail gmail dot com");
    expect(out.text).toBe("Aap ki email s-o-h-a-i-l at gmail dot com, sahi hai?");
    expect(out.spoken).toContain("s, o, h, a, i, l, at gmail dot com");
    expect(out.options).toContain("Skip");
    const next = await w.say("ji");
    expect(next.readBack).toBe(true);
    expect(w.ctx.booking?.draft.email).toBe("sohail@gmail.com");
  });

  it("not understood once: the email box is shown, and 'skip' still works", async () => {
    const w = await atEmail();
    const out = await w.say("hmm woh");
    expect(out.input).toBe("email");
    expect(out.text).toMatch(/neeche box mein likh dein, ya skip/i);
    const skipped = await w.say("skip");
    expect(skipped.readBack).toBe(true);
    expect(w.ctx.booking?.draft.email).toBeNull();
  });

  it("a typed email (from the box) is kept as typed, with no letter-by-letter check", async () => {
    const w = await atEmail();
    const out = await w.say("sohail.khan@gmail.com");
    expect(out.readBack).toBe(true);
    expect(w.ctx.booking?.draft.email).toBe("sohail.khan@gmail.com");
  });

  it("'nahi' at the check shows the box; a new spoken email at the check replaces it", async () => {
    const w = await atEmail();
    await w.say("sohail at gmail");
    const wrong = await w.say("nahi");
    expect(wrong.input).toBe("email");
    await w.say("suhail at gmail dot com");
    expect(w.ctx.booking?.asking).toBe("emailCheck");
    expect(w.ctx.booking?.draft.email).toBe("suhail@gmail.com");
  });
});

describe("the owner's yes words at the card", () => {
  it.each(["ok", "ok hai", "ok hain sab kuch", "sab theek hai", "theek hai", "jee", "bilkul", "sure", "correct", "ji sab sahi hai"])("'%s' confirms at the card", (t) => {
    expect(confirmsBooking(t)).toBe(true);
  });
  it.each(["hmm", "ok wait", "ok but change the time", "nahi", "ok nahi", "please", "maybe ok"])("'%s' does not", (t) => {
    expect(confirmsBooking(t)).toBe(false);
  });
  it("elsewhere 'ok' and 'jee' stay strict (the plain yes parser is unchanged)", () => {
    expect(parseYesNo("ok")).toBe("unclear");
    expect(parseYesNo("jee")).toBe("unclear");
  });
  it("'ok hain sab kuch' at the card books once; 'ok' over the read-back (overlap) never books", async () => {
    const w = makeWorld({ lang: "roman" });
    for (const t of ["book an appointment with Dr Bilal", "monday", "10", "Sara Noor", "03111234567", "skip"]) await w.say(t);
    const over = await w.say("ok", { confirmable: false });
    expect(over.booked).toBeUndefined();
    expect(w.submits.length).toBe(0);
    const out = await w.say("ok hain sab kuch");
    expect(out.booked).toBeDefined();
    expect(w.submits.length).toBe(1);
  });
});

describe("the receptionist's own name", () => {
  it("'thank you Ayesha' never picks Dr. Ayesha Rahman", async () => {
    const w = makeWorld();
    await w.say("thank you Ayesha");
    expect(w.ctx.lastDoctor ?? null).toBeNull();
    const out = await w.say("I want to book an appointment");
    expect(out.text).not.toContain("Ayesha Rahman");
  });
  it("'Dr Ayesha' still means the gynaecologist", async () => {
    const w = makeWorld();
    const out = await w.say("I want to book an appointment with Dr Ayesha");
    expect(out.text).toContain("Ayesha Rahman");
  });
  it("a patient called Ayesha keeps her name", async () => {
    const w = makeWorld();
    for (const t of ["book an appointment with Dr Bilal", "monday", "10"]) await w.say(t);
    await w.say("Ayesha Khan");
    expect(w.ctx.booking?.draft.fullName).toBe("Ayesha Khan");
  });
});

describe("self-test tone fixes (2026-11-09)", () => {
  async function atCard() {
    const w = makeWorld({ lang: "roman" });
    for (const t of ["Dr Bilal se appointment chahiye", "monday", "10", "Saima Noor", "03331234567", "skip"]) await w.say(t);
    expect(w.ctx.booking?.phase).toBe("awaiting_yes");
    return w;
  }
  it("#24: a corrected name is confirmed as a change, never 'Aap se mil kar khushi hui' again", async () => {
    const w = await atCard();
    await w.say("naam galat hai");
    const out = await w.say("mera naam Saima Nawaz hai");
    expect(out.text).toMatch(/^Theek hai, Saima Nawaz\./);
    expect(out.text).not.toContain("mil kar khushi");
  });
  it("#24: a corrected number is read back as the change", async () => {
    const w = await atCard();
    await w.say("number galat hai");
    const out = await w.say("zero three zero zero seven six five four three two one");
    expect(out.text).toMatch(/^Theek hai, 0300 765 4321\./);
  });
  it("#22: 'no' at the email check asks to type it, without 'Done, I've updated your email'", async () => {
    const w = makeWorld();
    for (const t of ["book an appointment with Dr Bilal", "monday", "10", "Sara Noor", "03111234567", "Sohail gmail dot com"]) await w.say(t);
    const out = await w.say("no");
    expect(out.text).toBe("No problem. Please type your email in the box below, or say skip.");
  });
});
