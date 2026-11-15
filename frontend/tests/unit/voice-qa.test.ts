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
    // The same FACTS as the text chat (case aside: "the same day" is "Same day" said in a sentence).
    for (const fact of c.includes) expect(out.text.toLowerCase(), `fact "${fact}"`).toContain(fact.toLowerCase());
    // Same brain: whenever the text assistant knows the answer, the voice answer starts with exactly its words.
    const text = answer({ mode: "patient", question: say }, w.pack);
    // (A greeting alone gets the receptionist's short welcome instead of the chat's long product welcome.)
    // Owner Part D (2026-11-09): where, fees, departments and tests are said like a receptionist (sentences, not catalog
    // lines); those answers carry the same facts but not the text chat's exact wording.
    const spokenStyle = ["departments", "greeting", "contact", "suggest_department", "fee", "lab_offer", "lab_report_time", "package_offer"];
    if (text.intent !== "unknown" && !spokenStyle.includes(out.intent)) expect(out.text.startsWith(text.text.replace(/sakta/g, "sakti").replace(/batata hoon/g, "batati hoon"))).toBe(true);
    expect(w.submits).toHaveLength(0);
  });

  it("says 'I don't know' with the clinic number instead of guessing", async () => {
    const w = makeWorld();
    for (const q of ["Is parking available?", "Do you accept insurance?", "Who won the cricket match yesterday?"]) {
      const out = await w.say(q);
      // Never the same sentence twice in a row: the same honest answer, said another way each time.
      expect(out.text).toMatch(/I don't know/);
      expect(out.text).toContain("+92 21 0000 0001");
    }
    const replies = w.log.slice(-3).map((r) => r.text);
    expect(replies[1]).not.toBe(replies[0]);
    expect(replies[2]).not.toBe(replies[1]);
  });
});
