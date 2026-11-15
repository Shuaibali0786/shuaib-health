// Feature 013, owner's fast polish 2026-11-15: greeting, name sound, the best browser voice, the phone on screen.
import { describe, expect, it } from "vitest";

import { welcomeLine } from "@/voice/phrases";
import { pronounce } from "@/voice/speechText";
import { preferredEnglishFemale } from "@/voice/voicePicker";
import type { VoiceInfo } from "@/voice/types";

import { makeWorld, packFor } from "../voice/harness";

const v = (name: string, lang = "en-US"): VoiceInfo => ({ name, lang, local: false });

describe("1: the greeting", () => {
  it("English: no 'English or Urdu' line", () => {
    expect(welcomeLine(packFor(false), "en")).toBe("Hello, welcome to Shuaib Health. I'm Ayesha. How can I help you today?");
  });
  it("Roman Urdu keeps it short, too", () => {
    expect(welcomeLine(packFor(false), "roman")).not.toMatch(/English ya Urdu/);
  });
});

describe("2: how the voice says her name", () => {
  it("TTS gets 'Aysha'; the screen keeps 'Ayesha'", () => {
    expect(pronounce("I'm Ayesha.")).toBe("I'm Aysha.");
    expect(welcomeLine(packFor(false), "en")).toContain("Ayesha");
  });
});

describe("3: the best browser voice, in the owner's order", () => {
  const guy = v("Microsoft Guy Online (Natural) - English (United States)");
  const jenny = v("Microsoft Jenny Online (Natural) - English (United States)");
  const aria = v("Microsoft Aria Online (Natural) - English (United States)");
  const google = v("Google US English");
  const zira = v("Microsoft Zira - English (United States)");
  const david = v("Microsoft David - English (United States)");
  it("Aria first, then Jenny, then Google US English, then any en-US female", () => {
    expect(preferredEnglishFemale([guy, jenny, google, aria, zira])).toBe(aria);
    expect(preferredEnglishFemale([guy, google, jenny, zira])).toBe(jenny);
    expect(preferredEnglishFemale([guy, zira, google])).toBe(google);
    expect(preferredEnglishFemale([david, zira])).toBe(zira);
  });
  it("never a male voice, and null when there is no good one", () => {
    expect(preferredEnglishFemale([david, guy])).toBeNull();
    expect(preferredEnglishFemale([])).toBeNull();
  });
});

describe("4: the full phone number on the confirm text", () => {
  it("the summary line shows it grouped ('0300 123 4567'), in English and Roman Urdu", async () => {
    for (const lang of ["en", "roman"] as const) {
      const w = makeWorld({ lang });
      const turns = lang === "en"
        ? ["I want to book with Dr Maryam Baloch", "13 at 2 pm", "my name is Sohail Ahmed", "yes", "zero three zero zero one two three four five six seven", "yes", "skip"]
        : ["Dr Maryam se appointment chahiye", "13 tareekh 2 baje", "mera naam Atta Rehman hai", "haan", "zero three zero zero one two three four five six seven", "haan", "skip"];
      let out = await w.say(turns[0] as string);
      for (const t of turns.slice(1)) out = await w.say(t, { spoken: true });
      expect(out.readBack).toBe(true);
      expect(out.text).toContain("Phone: 0300 123 4567.");
    }
  });
});
