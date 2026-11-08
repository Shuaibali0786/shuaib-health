// Feature 013: the 10 scripted voice-booking conversations (tests/voice/booking-scripts/*.json).
// They run the real router, safety guards and booking dialog with a fake doctor schedule and a fake booking
// route, so they never touch a network, a microphone or production.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { makeWorld, type SubmitMode } from "../voice/harness";

type ScriptTurn = { say: string; confirmable?: boolean; expect?: string[]; forbid?: string[]; submits?: number };
type Script = { name: string; mode?: SubmitMode; turns: ScriptTurn[]; final: { bookings: number; payload?: Record<string, unknown> } };

const DIR = join(__dirname, "..", "voice", "booking-scripts");
const files = readdirSync(DIR).filter((f) => f.endsWith(".json")).sort();

describe("voice booking scripts", () => {
  it("has the 10 scripts the plan promises", () => {
    expect(files.length).toBeGreaterThanOrEqual(10);
  });

  it.each(files)("%s", async (file) => {
    const script = JSON.parse(readFileSync(join(DIR, file), "utf8")) as Script;
    const world = makeWorld({ mode: script.mode });
    for (const [index, turn] of script.turns.entries()) {
      const out = await world.say(turn.say, { confirmable: turn.confirmable ?? true });
      const where = `${file} turn ${index + 1} ("${turn.say}") -> "${out.text}"`;
      // What the patient sees (the chat) and what is read aloud (the read-back has the phone digit by digit).
      const heard = `${out.text} ${out.spoken ?? ""}`.toLowerCase();
      for (const piece of turn.expect ?? []) expect(heard, where).toContain(piece.toLowerCase());
      for (const piece of turn.forbid ?? []) expect(heard, where).not.toContain(piece.toLowerCase());
      if (turn.submits !== undefined) expect(world.submits.length, where).toBe(turn.submits);
    }
    expect(world.ctx.bookingsMade).toBe(script.final.bookings);
    expect(world.submits.length).toBe(script.final.bookings);
    if (script.final.payload) expect(world.submits.at(-1)?.payload).toMatchObject(script.final.payload);
  });
});
