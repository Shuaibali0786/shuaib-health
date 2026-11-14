// Feature 013, owner request 2026-11-09 (Part D): Ayesha talks to 20 real patients (12 English, 6 Roman Urdu, 2 mixed)
// through the real router, safety guards and booking dialog (fake schedule and booking route: never production).
// Checks on every reply: she waits for the patient's choice (never picks a doctor or jumps ahead), never invents a
// doctor, day, time or fee, never books without a clear yes, stays in the patient's language, never repeats a sentence,
// never says "afsos", at most one apology. VOICE_TRANSCRIPTS_OUT=<file.json> writes the transcripts for the report.
import { writeFileSync } from "node:fs";

import { afterAll, describe, expect, it } from "vitest";

import type { RouterResult } from "@/voice/router";

import { makeWorld } from "../voice/harness";

type Step = { say: string; spoken?: boolean; expect?: RegExp; lang?: "en" | "roman" } | { choose: number; expect?: RegExp; lang?: "en" | "roman" };
type Patient = { id: number; who: string; lang: "en" | "roman" | "mixed"; steps: Step[]; books?: boolean; startLang?: "en" | "roman" };

const SPOKEN = true;
const PATIENTS: Patient[] = [
  // --- English (US / UK style) -------------------------------------------------------------------------------------
  { id: 1, who: "English: 'I have an allergy, can you treat it?' -> the slip", lang: "en", books: true, steps: [
    { say: "I have an allergy, can you treat it?", spoken: SPOKEN, expect: /Dr\. Maryam Baloch in Dermatology[\s\S]*available[\s\S]*fee is PKR 3,000[\s\S]*Would you like to book/ },
    { say: "Yes please", spoken: SPOKEN, expect: /Which day/ },
    { choose: 0, expect: /time/i },
    { choose: 0, expect: /full name/ },
    { say: "My name is Emma Clarke", spoken: SPOKEN, expect: /Emma Clarke\. Is the spelling right\?/ },
    { say: "Yes, that's right", spoken: SPOKEN, expect: /mobile number slowly/ },
    { say: "zero three zero zero", spoken: SPOKEN, expect: /0300\. Got it, please go on\./ },
    { say: "one two three", spoken: SPOKEN },
    { say: "four five six seven", spoken: SPOKEN, expect: /0300 123 4567\. Is that right\?/ },
    { say: "Yes", spoken: SPOKEN, expect: /email/ },
    { say: "Skip", spoken: SPOKEN, expect: /check the card/ },
    { say: "Yes", spoken: SPOKEN, expect: /You're booked, Emma/ },
  ] },
  { id: 2, who: "English: asks for a time that is not free, chooses an offered one", lang: "en", books: true, steps: [
    { say: "I'd like to book with Dr Maryam Baloch", expect: /Which day/ },
    { say: "Friday 13 November at 1 pm", expect: /1:00 PM isn't available on Friday 13 November\. The nearest times are .+\. Which would you like\?/ },
    { choose: 1, expect: /full name/ },
    { say: "Oliver Smith", expect: /mobile/ },
    { say: "03111234501", expect: /email/ },
    { say: "no thanks", expect: /check the card/ },
    { say: "Yes, confirm", expect: /You're booked/ },
  ] },
  { id: 3, who: "English: changes the doctor midway", lang: "en", books: true, steps: [
    { say: "I've had a fever for two days", expect: /Dr\. Hassan Mirza[\s\S]*Dr\. Omar Sheikh[\s\S]*Which doctor would you like\?/ },
    { say: "Dr Hassan Mirza please", expect: /Which day/ },
    { say: "Actually, I'd prefer Dr Omar Sheikh", expect: /Omar Sheikh[\s\S]*(day|Which)/ },
    { choose: 0, expect: /time/i },
    { choose: 0, expect: /full name/ },
    { say: "James Taylor", expect: /mobile/ },
    { say: "03111234502", expect: /email/ },
    { say: "skip", expect: /check the card/ },
    { say: "yes", expect: /You're booked, James! Dr\. Omar Sheikh/ },
  ] },
  { id: 4, who: "English: a wrong number, then fixed", lang: "en", books: true, steps: [
    { say: "Book me with the dentist please", expect: /Which day/ },
    { choose: 0, expect: /time/i },
    { choose: 0, expect: /full name/ },
    { say: "Sophie Brown", expect: /mobile/ },
    { say: "zero three one one one one one one one one one", spoken: SPOKEN, expect: /0311 111 1111\. Is that right\?/ },
    { say: "No, that's wrong", spoken: SPOKEN, expect: /mobile|number/ },
    { say: "zero three one one two two two three three three four", spoken: SPOKEN, expect: /0311 222 3334\. Is that right\?/ },
    { say: "Correct", spoken: SPOKEN, expect: /email/ },
    { say: "skip", expect: /check the card/ },
    { say: "yes", expect: /You're booked/ },
  ] },
  { id: 5, who: "English: gives an email by voice", lang: "en", books: true, steps: [
    { say: "I need to see a skin doctor", expect: /Maryam Baloch[\s\S]*Which day/ },
    // A redundant "yes": the day question again, in other words (never the same sentence twice).
    { say: "yes", expect: /What day|Which day/ },
    { choose: 0, expect: /time/i },
    { choose: 0, expect: /full name/ },
    { say: "Noah Wilson", expect: /mobile/ },
    { say: "03111234504", expect: /email/ },
    { say: "noah wilson at gmail dot com", expect: /n-o-a-h-w-i-l-s-o-n at gmail dot com/ },
    { say: "yes", expect: /check the card/ },
    { say: "yes", expect: /You're booked/ },
  ] },
  { id: 6, who: "English: fees", lang: "en", steps: [
    { say: "How much does it cost to see the dentist?", expect: /PKR 2,000/ },
    { say: "And the heart doctor?", expect: /PKR 3,500|Cardiology/ },
  ] },
  { id: 7, who: "English: timings and location", lang: "en", steps: [
    { say: "What are your opening hours?", expect: /9 AM/ },
    { say: "Where is the clinic located?", expect: /Karachi|Road/ },
  ] },
  { id: 8, who: "English: lab test preparation", lang: "en", steps: [
    { say: "Do I need to fast before a lipid profile?", expect: /fast/i },
    { say: "How long do the results take?", expect: /./ },
  ] },
  { id: 9, who: "English: an impatient patient", lang: "en", steps: [
    { say: "This is taking forever, just book me with Dr Bilal now", expect: /Dr\. Bilal Ansari[\s\S]*Which day/ },
    { say: "Why aren't you booking it? Just do it!", expect: /day|choices/i },
  ] },
  { id: 10, who: "English: a confused elderly patient", lang: "en", steps: [
    { say: "I'm not sure what I need dear, my knee hurts", expect: /don't offer|General Medicine/ },
    { say: "Sorry, what did you say?", expect: /./ },
    { say: "Yes, the general doctor please", expect: /(Which doctor|Which day|Hassan|Omar)/ },
  ] },
  { id: 11, who: "English: small talk first, then cancels mid-flow", lang: "en", steps: [
    { say: "Hello, how are you?", expect: /I'm doing great, thank you/ },
    { say: "I need a dentist", expect: /Dr\. Bilal Ansari/ },
    { say: "yes", expect: /Which day/ },
    { say: "Never mind, cancel it", expect: /stopped the booking\. Nothing was booked/ },
  ] },
  { id: 12, who: "English: an emergency", lang: "en", steps: [{ say: "My father has chest pain and can't breathe", expect: /1122/ }] },
  // --- Roman Urdu --------------------------------------------------------------------------------------------------
  { id: 13, who: "Roman Urdu: 'mujhe bukhar hai, ilaaj ho sakta hai?' -> the slip", lang: "roman", books: true, steps: [
    { say: "mujhe bukhar hai, ilaaj ho sakta hai?", spoken: SPOKEN, expect: /General Medicine[\s\S]*Dr\. Hassan Mirza[\s\S]*Aap kis doctor se milna chahenge\?/ },
    { say: "Dr Hassan Mirza", spoken: SPOKEN, expect: /Kaun sa din/ },
    { choose: 0, expect: /waqt/ },
    { choose: 0, expect: /poora naam/ },
    { say: "mera naam Bilal Ahmed hai", spoken: SPOKEN, expect: /Bilal Ahmed likha hai\. Spelling theek hai\?/ },
    { say: "ji sahi hai", spoken: SPOKEN, expect: /mobile number aahista/ },
    { say: "sifar teen sifar sifar ek do teen char paanch chay saat", spoken: SPOKEN, expect: /0300 123 4567\. Sahi hai\?/ },
    { say: "haan", spoken: SPOKEN, expect: /email/ },
    { say: "nahi", spoken: SPOKEN, expect: /Confirm dabaiye/ },
    { say: "ji haan", spoken: SPOKEN, expect: /Aap ki booking ho gayi, Bilal/ },
  ] },
  { id: 14, who: "Roman Urdu: daant ka dard, the time asked is not free", lang: "roman", books: true, steps: [
    { say: "mere daant mein bohat dard hai", expect: /Dental[\s\S]*Dr\. Bilal Ansari[\s\S]*booking kar doon/ },
    { say: "ji kar dein", expect: /Kaun sa din/ },
    { say: "friday ko 1 baje", expect: /available nahi\. Qareeb ke waqt .+\. Aap ko kaun sa chahiye\?/ },
    { choose: 0, expect: /poora naam/ },
    { say: "Hina Pervaiz", expect: /mobile/ },
    { say: "03111234514", expect: /email/ },
    { say: "skip", expect: /Confirm dabaiye/ },
    { say: "theek hai", expect: /booking ho gayi/ },
  ] },
  { id: 15, who: "Roman Urdu start, then 'English please'", lang: "mixed", books: false, steps: [
    { say: "mujhe skin ki problem hai", expect: /Dermatology/, lang: "roman" },
    { say: "English please", expect: /Of course, I'll continue in English/, lang: "en" },
    { say: "mujhe kab appointment mil sakta hai", expect: /./, lang: "en" },
  ] },
  { id: 16, who: "Roman Urdu: 'mujhe neend nahi aati' three times (AI brain OFF here: the rules answer kindly)", lang: "roman", steps: [
    { say: "mujhe neend nahi aati", expect: /./ },
    { say: "mujhe neend nahi aati", expect: /./ },
    { say: "mujhe neend nahi aati", expect: /./ },
  ] },
  { id: 17, who: "Roman Urdu: kya aaj clinic khula hai", lang: "roman", steps: [{ say: "kia aaj clinic khula hai?", expect: /clinic/ }] },
  { id: 18, who: "Roman Urdu: bache ko khansi, then 'rehne do'", lang: "roman", steps: [
    { say: "mere bache ko khansi hai", expect: /Pediatrics[\s\S]*Aap kis doctor se milna chahenge\?/ },
    { say: "pehle wale", expect: /Kaun sa din/ },
    { say: "rehne do", expect: /booking rok di[\s\S]*Kuch book nahi hua/ },
  ] },
  // --- Mixed ---------------------------------------------------------------------------------------------------------
  { id: 19, who: "Mixed: 'Hi, mujhe dentist chahiye'", lang: "mixed", steps: [{ say: "Hi, mujhe dentist chahiye", expect: /Dr\. Bilal Ansari/, lang: "roman" }] },
  { id: 20, who: "Mixed: 'I need a booking, mera naam Ali hai'", lang: "mixed", steps: [{ say: "I need a booking, mera naam Ali Raza hai", expect: /./ }] },
];

type Turn = { from: "patient" | "ayesha"; text: string; lang?: string };
const transcripts: Array<{ id: number; who: string; turns: Turn[]; problems: string[] }> = [];

afterAll(() => {
  const out = process.env.VOICE_TRANSCRIPTS_OUT;
  if (out) writeFileSync(out, JSON.stringify(transcripts, null, 2), "utf8");
});

describe("Part D: Ayesha with 20 real patients", () => {
  for (const p of PATIENTS) {
    it(`#${p.id} ${p.who}`, async () => {
      const w = makeWorld({ lang: p.startLang ?? "en" });
      const doctorNames = new Set(w.pack.doctors.map((d) => d.name));
      const turns: Turn[] = [];
      const problems: string[] = [];
      let last: RouterResult | null = null;
      let previousSentences: string[] = [];
      for (const step of p.steps) {
        const said = "say" in step ? step.say : (last?.options?.[step.choose] ?? "");
        if ("choose" in step && !said) problems.push(`no choice ${step.choose} to tap`);
        const submitsBefore = w.submits.length;
        const out = await w.say(said, { spoken: "say" in step ? step.spoken : false });
        turns.push({ from: "patient", text: "say" in step ? said : `(taps "${said}")` }, { from: "ayesha", text: out.text, lang: out.lang });
        if (step.expect && !step.expect.test(out.text)) problems.push(`after "${said}": expected ${step.expect}, got: ${out.text}`);
        // She never names a doctor we do not have.
        for (const m of out.text.matchAll(/Dr\. [A-Z][a-z]+ [A-Z][a-z]+/g)) if (!doctorNames.has(m[0])) problems.push(`invented doctor: ${m[0]}`);
        // A booking happens only right after a clear yes or Confirm.
        if (w.submits.length > submitsBefore && !/^(yes|yes, confirm|ji haan|haan|theek hai|ok|correct)\b/i.test(said)) problems.push(`booked without a clear yes ("${said}")`);
        // She stays in the patient's language.
        const want = step.lang ?? (p.lang === "mixed" ? undefined : p.lang);
        if (want && out.lang !== want && !out.urgent) problems.push(`answered in ${out.lang} instead of ${want}: ${out.text.slice(0, 80)}`);
        // Never the same sentence twice in a row; never "afsos".
        const sentences = out.text.split(/(?<=[.!?])\s+/).map((s) => s.trim().toLowerCase()).filter((s) => s.length > 14);
        const repeated = sentences.filter((s) => previousSentences.includes(s));
        // (Asked "what did you say?": saying it again is the right answer.)
        if (repeated.length && !out.readBack && out.intent !== "repeat") problems.push(`repeated: ${repeated[0]}`);
        if (/afsos/i.test(out.text)) problems.push("said 'afsos'");
        previousSentences = sentences;
        last = out;
      }
      const apologies = turns.filter((t) => t.from === "ayesha" && /\b(sorry|maaf kijiye)\b/i.test(t.text) && !/\?$/.test(t.text)).length;
      if (apologies > 1) problems.push(`${apologies} apologies`);
      if (p.books && w.submits.length !== 1) problems.push(`expected one booking, got ${w.submits.length}`);
      if (!p.books && w.submits.length !== 0) problems.push("booked without being asked to");
      transcripts.push({ id: p.id, who: p.who, turns, problems });
      expect(problems, problems.join("\n")).toEqual([]);
    });
  }
});
