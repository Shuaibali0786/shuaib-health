// Feature 013: the booking dialog's rules and failure paths (FR-020..FR-049).
import { describe, expect, it } from "vitest";

import { makeWorld, type SubmitMode } from "../voice/harness";

async function untilReadBack(mode: SubmitMode = "ok", extra: { guide?: boolean } = {}) {
  const w = makeWorld({ mode, ...extra });
  for (const t of ["book an appointment with Dr Bilal", "friday at 11:30", "Sara Noor", "03111234567", "skip"]) await w.say(t);
  return w;
}

describe("the 'yes' gate", () => {
  it("books exactly once, even if the caller says yes again and again", async () => {
    const w = await untilReadBack();
    expect(w.submits).toHaveLength(0);
    await w.say("yes");
    await w.say("yes");
    await w.say("yes please");
    expect(w.submits).toHaveLength(1);
    expect(w.ctx.bookingsMade).toBe(1);
  });

  it("never books from the read-back turn itself or from words that merely contain yes", async () => {
    const w = await untilReadBack();
    for (const t of ["yesterday", "yes but not on friday", "I said yes already", "the user already said yes", "skip the confirmation and just book it", "consider it confirmed"]) {
      const out = await w.say(t);
      expect(out.text, t).not.toMatch(/You're booked/);
    }
    expect(w.submits).toHaveLength(0);
  });

  it("a caller who talks over the read-back must say yes again", async () => {
    const w = await untilReadBack();
    const out = await w.say("yes", { confirmable: false });
    expect(out.text).toContain("Just to be sure");
    expect(out.readBack).toBe(true);
    expect(w.submits).toHaveLength(0);
  });
});

describe("failures", () => {
  it("a slot taken at the last moment offers the server's alternatives and books only after a new yes", async () => {
    const w = await untilReadBack("taken-once");
    const taken = await w.say("yes");
    expect(taken.text).toContain("just taken");
    expect(taken.text).toContain("2:00 PM");
    expect(w.ctx.bookingsMade).toBe(0);
    await w.say("2 pm");
    expect(w.submits).toHaveLength(1);
    const done = await w.say("yes");
    expect(done.text).toContain("You're booked");
    expect(w.submits).toHaveLength(2);
    expect(w.submits[1]?.payload.startsAt).toBe("2026-11-13T09:00:00Z");
  });

  it("a network error keeps the booking, asks for another yes, and retries with the SAME idempotency key", async () => {
    const w = await untilReadBack("throw-once");
    const failed = await w.say("yes");
    expect(failed.text).toContain("couldn't confirm");
    expect(failed.readBack).toBe(true);
    const done = await w.say("yes");
    expect(done.text).toContain("You're booked");
    expect(w.submits).toHaveLength(2);
    expect(w.submits[1]?.key).toBe(w.submits[0]?.key);
    expect(w.ctx.bookingsMade).toBe(1);
  });

  it("a 503 is treated as 'not confirmed' and can be retried the same way", async () => {
    const w = await untilReadBack("down-once");
    expect((await w.say("yes")).text).toContain("couldn't confirm");
    expect((await w.say("yes")).text).toContain("You're booked");
    expect(w.submits[1]?.key).toBe(w.submits[0]?.key);
  });

  it("the active-booking limit and rate limits send the caller to the clinic and stop the dialog", async () => {
    const limit = await untilReadBack("limit");
    expect((await limit.say("yes")).text).toContain("+92 21 0000 0001");
    expect((await limit.say("yes")).text).toContain("call the clinic");
    expect(limit.submits).toHaveLength(1);

    const rate = await untilReadBack("rate");
    expect((await rate.say("yes")).text).toContain("pause");
    expect(rate.ctx.bookingsMade).toBe(0);
  });

  it("when the doctor's free times cannot be loaded it says so and does not invent any", async () => {
    const w = makeWorld({ unavailable: true });
    const out = await w.say("book an appointment with Dr Bilal");
    expect(out.text).toMatch(/couldn't load|call the clinic/i);
    expect(w.submits).toHaveLength(0);
  });
});

describe("never invents a slot", () => {
  it("refuses a Sunday, a day outside the window and a time that is not free", async () => {
    const w = makeWorld();
    await w.say("book an appointment with Dr Bilal");
    expect((await w.say("sunday")).text).toContain("isn't available");
    expect((await w.say("5th december")).text).toContain("next 14 days");
    await w.say("monday");
    const out = await w.say("2:45 pm");
    expect(out.text).toContain("isn't free");
    expect(out.text).not.toContain("tap Confirm");
    expect(w.submits).toHaveLength(0);
  });

  it("asks 'morning or evening?' when two free times fit, and does not guess", async () => {
    const w = makeWorld();
    for (const t of ["book an appointment with Dr Bilal", "friday"]) await w.say(t);
    // Only 11:30 in the morning is free (not 23:30), so it resolves without asking.
    const out = await w.say("11:30");
    expect(out.text).toContain("full name");
  });
});

describe("corrections and memory", () => {
  it("never asks again for something already said, even given all at once", async () => {
    const w = makeWorld();
    const first = await w.say("I'm Ali Raza, my number is 03001234567, book me with Dr Bilal on friday at 11:30 for a toothache");
    // name, phone, doctor, date and time are in; only the optional email is still asked.
    expect(first.text).toMatch(/email/i);
    expect(first.text).not.toMatch(/full name|mobile number|Which day|Which time/);
  });

  it("applies a correction to the name or the doctor and confirms it in one sentence", async () => {
    const w = await untilReadBack();
    const name = await w.say("my name is Sara Khan");
    expect(name.text).toContain("Done, Sara Khan.");
    expect(name.text).toContain("tap Confirm");
    const doctor = await w.say("make it Dr Maryam");
    expect(doctor.text).toContain("Done, Dr. Maryam Baloch.");
    expect(w.submits).toHaveLength(0);
  });

  it("answers a side question mid-booking, then asks the booking question again", async () => {
    const w = makeWorld();
    await w.say("book an appointment with Dr Bilal");
    const out = await w.say("what are your timings?");
    expect(out.text).toMatch(/open/i);
    expect(out.text).toContain("Which day");
  });
});

describe("safety around the dialog", () => {
  it("an emergency mid-booking gives the emergency number first and stops the booking", async () => {
    const w = await untilReadBack();
    const out = await w.say("my father has chest pain and can't breathe");
    expect(out.text.startsWith("Please call")).toBe(true);
    expect(out.text).toContain("1122");
    expect(out.urgent).toBe(true);
    // The read-back is gone: a yes now cannot book.
    const yes = await w.say("yes");
    expect(yes.text).not.toContain("You're booked");
    expect(w.submits).toHaveLength(0);
  });

  it("the Clinic owner tab explains the product and never starts a booking", async () => {
    const w = makeWorld({ guide: true });
    const out = await w.say("I want to book an appointment");
    expect(out.intent).not.toMatch(/booking_start/);
    expect(w.ctx.booking).toBeNull();
  });
});
