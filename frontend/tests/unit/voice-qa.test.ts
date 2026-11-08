// Feature 013: 30 normal questions answered from public data. The voice answer must carry the same facts as the
// text assistant's answer (SC-006), and may add only a short, warm nudge.
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { answer } from "@/agent/localEngine";

import { makeWorld } from "../voice/harness";

type Case = { id: number; say: string; includes: string[] };
const CASES = JSON.parse(readFileSync(join(__dirname, "..", "voice", "qa.json"), "utf8")) as Case[];

describe("normal questions by voice", () => {
  it("has 30 questions in English and Roman Urdu", () => {
    expect(CASES).toHaveLength(30);
  });

  it.each(CASES.map((c) => [c.id, c.say, c] as const))("#%i %s", async (_id, say, c) => {
    const w = makeWorld();
    const out = await w.say(say);
    for (const fact of c.includes) expect(out.text, `fact "${fact}"`).toContain(fact);
    // Same brain: whenever the text assistant knows the answer, the voice answer starts with exactly its words.
    const text = answer({ mode: "patient", question: say }, w.pack);
    if (text.intent !== "unknown" && out.intent !== "departments") expect(out.text.startsWith(text.text)).toBe(true);
    expect(w.submits).toHaveLength(0);
  });

  it("says 'I don't know' with the clinic number instead of guessing", async () => {
    const w = makeWorld();
    for (const q of ["Is parking available?", "Do you accept insurance?", "Who won the cricket match yesterday?"]) {
      const out = await w.say(q);
      expect(out.text).toContain("I don't know");
      expect(out.text).toContain("+92 21 0000 0001");
    }
  });
});
