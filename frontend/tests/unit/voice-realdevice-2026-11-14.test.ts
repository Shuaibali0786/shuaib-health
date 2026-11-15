// Feature 013, owner's real-device test on the preview (2026-11-14): one block per item, with the owner's own words.
import { describe, expect, it } from "vitest";

import { withoutEmptyValues } from "@/voice/bookingDialog";
import { parseDate } from "@/voice/parse/date";
import { parseTimes, withoutLeadingDay } from "@/voice/parse/time";
import { closingReply, greetingOnly, smallTalkOf } from "@/voice/router";

import { makeWorld, NOW } from "../voice/harness";

/** Through the day: Dr. Maryam Baloch (Dermatology), then whatever the patient says about the day. */
async function toTheDay() {
  const w = makeWorld();
  const first = await w.say("I want to book with Dr Maryam Baloch");
  expect(w.ctx.booking?.asking).toBe("date");
  return { w, first };
}

/** A booking from the doctor to the card, with `day` (and maybe a time) said at the day question. */
async function toTheCard(day: string, extra: string[] = []) {
  const { w } = await toTheDay();
  const turns = [await w.say(day, { spoken: true })];
  for (const t of extra) turns.push(await w.say(t, { spoken: true }));
  return { w, turns };
}

describe("1 (critical): a time is never picked without the patient choosing it", () => {
  it("'18 #2 PM' is Wednesday 18 November + 2 PM, never 6:00 PM; 2 PM is not free that day, so the free times are offered and she WAITS", async () => {
    const { w } = await toTheDay();
    const out = await w.say("18 #2 PM", { spoken: true });
    expect(w.ctx.booking?.draft.date).toBe("2026-11-18");
    expect(w.ctx.booking?.draft.time).toBeNull();
    expect(w.ctx.booking?.draft.startsAt).toBeNull();
    expect(w.ctx.booking?.asking).toBe("time");
    expect(out.text).toMatch(/^2:00 PM isn't available on Wednesday 18 November\. The nearest times are .+\. Which would you like\?$/);
    expect(out.text).not.toMatch(/6:00 PM/);
  });

  it("a time said WITHOUT an understood day is not kept: after 'Wednesday 18th November' the time is ASKED (the owner's 6 PM bug)", async () => {
    const { w } = await toTheDay();
    await w.say("#2 PM", { spoken: true });
    expect(w.ctx.booking?.draft.date).toBeNull();
    expect(w.ctx.booking?.pendingTimes).toEqual([]);
    const out = await w.say("Wednesday 18th November", { spoken: true });
    expect(w.ctx.booking?.draft.date).toBe("2026-11-18");
    expect(w.ctx.booking?.asking).toBe("time");
    expect(w.ctx.booking?.draft.startsAt).toBeNull();
    expect(out.text).toMatch(/On Wednesday 18 November I have .+\. Which time suits you\?/);
    expect(out.options?.length).toBeGreaterThan(0);
  });

  it("the day alone: the free times are offered and she waits (never the name next)", async () => {
    const { w } = await toTheDay();
    const out = await w.say("Wednesday 18th November", { spoken: true });
    expect(w.ctx.booking?.asking).toBe("time");
    expect(out.text).not.toMatch(/name/i);
  });

  it("a day WITH a free time is used, and said back before the next question ('Friday 13 November at 2:00 PM is free')", async () => {
    const { w, turns } = await toTheCard("13 at 2 pm");
    expect(w.ctx.booking?.draft.time).toBe("14:00");
    expect(turns[0]?.text).toMatch(/^Friday 13 November at 2:00 PM is free\. May I have your full name, please\?$/);
  });

  it("Roman Urdu, '13 tareekh 2 baje': the same, in Urdu", async () => {
    const w = makeWorld({ lang: "roman" });
    await w.say("Dr Maryam se appointment chahiye");
    const out = await w.say("13 tareekh 2 baje", { spoken: true });
    expect(w.ctx.booking?.draft.time).toBe("14:00");
    expect(out.text).toMatch(/Friday 13 November ko 2:00 PM khali hai\./);
  });

  it("typed, too: a typed time without a day is not kept", async () => {
    const { w } = await toTheDay();
    await w.say("2 pm please");
    await w.say("Wednesday 18th November");
    expect(w.ctx.booking?.asking).toBe("time");
  });

  it("before the confirm, the doctor, day, date, TIME and fee are always said (text and voice)", async () => {
    const { w } = await toTheCard("13 at 2 pm", ["my name is Sohail Ahmed", "yes", "zero three zero zero one two three four five six seven", "yes", "skip"]);
    const card = w.ctx.booking;
    expect(card?.phase).toBe("awaiting_yes");
    const last = w.log.at(-1);
    expect(last?.text).toContain("Dr. Maryam Baloch, Friday 13 November at 2:00 PM, fee PKR 3,000. Shall I confirm?");
    expect(last?.spoken).toContain("Dr. Maryam Baloch, Friday 13 November at 2:00 PM, fee 3,000 rupees. Shall I confirm?");
  });
});

describe("2: day + time in one breath", () => {
  it.each([
    ["18 #2 PM", "2026-11-18", ["14:00"]],
    ["18 at 2 PM", "2026-11-18", ["14:00"]],
    ["18 at 2", "2026-11-18", ["02:00", "14:00"]],
    ["eighteen two pm", "2026-11-18", ["14:00"]],
    ["18 tareekh 2 baje", "2026-11-18", ["02:00", "14:00"]],
    ["Wednesday 18 at 2pm", "2026-11-18", ["14:00"]],
  ])("'%s' -> day %s, time %j", (said, date, times) => {
    expect(parseDate(said, NOW, true)).toBe(date);
    expect(parseTimes(said)).toEqual(times);
  });
  it("a day of the month is never an hour", () => {
    expect(parseTimes("18 pm")).toEqual([]);
    expect(parseTimes("the 18 at 2")).toEqual(["02:00", "14:00"]);
    expect(withoutLeadingDay("18 2 pm")).toBe("2 pm");
  });
  it("'11 30 pm' and '3:30' stay times", () => {
    expect(parseTimes("11 30 pm")).toEqual(["23:30"]);
    expect(parseTimes("3:30")).toEqual(["03:30", "15:30"]);
    expect(parseDate("11 30 pm", NOW, true)).toBeNull();
  });
});

describe("3: never 'null', 'undefined' or 'NaN'; a wrong name gets a sorry and a re-ask", () => {
  it("'No, it's wrong' at the name check", async () => {
    const { w } = await toTheCard("13 at 2 pm", ["my name is Sohail Ahmed"]);
    expect(w.ctx.booking?.asking).toBe("nameCheck");
    const out = await w.say("No, it's wrong", { spoken: true });
    expect(out.text).toBe("Sorry about that. Could you say your full name again, or type it below?");
    expect(out.input).toBe("name");
    expect(out.text).not.toMatch(/null|undefined|NaN/);
    await w.say("Sohail Akhtar", { spoken: true });
    expect(w.ctx.booking?.draft.fullName).toBe("Sohail Akhtar");
  });
  it("a sentence with a missing value is dropped", () => {
    expect(withoutEmptyValues("Sure, null. May I have your full name, please?")).toBe("May I have your full name, please?");
    expect(withoutEmptyValues("Fee: PKR NaN. Shall I confirm?")).toBe("Shall I confirm?");
    expect(withoutEmptyValues("All fine.")).toBe("All fine.");
  });
});

describe("4: greetings get greetings", () => {
  it.each(["Hi, good morning", "hello good morning", "good morning", "Hi good morning ji"])("'%s' -> 'Good morning! How can I help you today?'", async (said) => {
    expect(smallTalkOf(said)).toBeNull();
    expect(greetingOnly(said)).toBe(true);
    const w = makeWorld();
    const out = await w.say(said);
    expect(out.text).toBe("Good morning! How can I help you today?");
  });
  it("Roman Urdu: 'Assalam o Alaikum! Main aap ki kya madad kar sakti hoon?'", async () => {
    const w = makeWorld({ lang: "roman" });
    const out = await w.say("hello ji");
    expect(out.text).toBe("Assalam o Alaikum! Main aap ki kya madad kar sakti hoon?");
  });
  it("'I'm good' is still 'Glad to hear that!'", async () => {
    const w = makeWorld();
    expect((await w.say("I'm good")).text).toMatch(/^Glad to hear that!/);
  });
});

describe("7: the goodbye, like a real receptionist", () => {
  async function booked(lang: "en" | "roman" = "en") {
    const w = makeWorld({ lang });
    const turns = lang === "en"
      ? ["I want to book with Dr Maryam Baloch", "13 at 2 pm", "my name is Sohail Ahmed", "yes", "zero three zero zero one two three four five six seven", "yes", "skip", "yes"]
      : ["Dr Maryam se appointment chahiye", "13 tareekh 2 baje", "mera naam Atta Rehman hai", "haan", "zero three zero zero one two three four five six seven", "haan", "skip", "ji haan"];
    let out = await w.say(turns[0] as string);
    for (const t of turns.slice(1)) out = await w.say(t, { spoken: true, confirmable: true });
    return { w, out };
  }
  it("English: the booked message ends with the warm goodbye, and the call ends", async () => {
    const { out } = await booked();
    expect(out.booked).toBeTruthy();
    expect(out.text).toMatch(/^You're all set, Sohail! Dr\. Maryam Baloch, Friday 13 November at 2:00 PM\. Your reference is .+\. Please tap Open my slip and download it\. Thank you, we look forward to seeing you on Friday\. Take care, and have a lovely day! Goodbye\.$/);
    expect(out.endCall).toBe(true);
  });
  it("Roman Urdu: '... Shukriya, Friday ko aap ka intezar rahega. Apna khayal rakhiye. Allah Hafiz!'", async () => {
    const { out } = await booked("roman");
    expect(out.text).toMatch(/^Aap ki booking ho gayi, Atta! .+ Open my slip dabaiye aur slip download kar lein\. Shukriya, Friday ko aap ka intezar rahega\. Apna khayal rakhiye\. Allah Hafiz!$/);
    expect(out.endCall).toBe(true);
  });
  it.each(["thank you", "thanks", "bye", "goodbye", "ok thanks"])("after the booking, '%s' -> 'You're very welcome! Take care. Goodbye.'", async (said) => {
    const { w } = await booked();
    const out = await w.say(said);
    expect(out.text).toBe("You're very welcome! Take care. Goodbye.");
    expect(out.endCall).toBe(true);
  });
  it.each(["Allah Hafiz", "Khuda Hafiz"])("an English-speaking patient's '%s' -> 'Allah Hafiz, take care!'", async (said) => {
    const { w } = await booked();
    expect((await w.say(said)).text).toBe("Allah Hafiz, take care!");
  });
  it.each(["shukriya", "Allah Hafiz", "Khuda Hafiz", "theek hai bas"])("Roman Urdu '%s' -> 'Koi baat nahi, aap ka shukriya. Allah Hafiz!'", async (said) => {
    const { w } = await booked("roman");
    const out = await w.say(said);
    expect(out.text).toBe("Koi baat nahi, aap ka shukriya. Allah Hafiz!");
    expect(out.endCall).toBe(true);
  });
  it("before any booking, 'thank you' is not a goodbye", () => {
    expect(closingReply("what are your timings", "en")).toBeNull();
  });
});
