import { describe, expect, it } from "vitest";

import { hasUrduScript, replyLanguage, urduToLatin } from "@/voice/language";
import { pickVoice, voiceGender } from "@/voice/voicePicker";
import type { VoiceInfo } from "@/voice/types";

const v = (name: string, lang: string, local = false): VoiceInfo => ({ name, lang, local });

describe("reply language", () => {
  it("follows Roman Urdu words and Urdu letters", () => {
    expect(replyLanguage("Dr Ayesha kab baithti hain?", "en")).toBe("roman");
    expect(replyLanguage("ڈاکٹر کب ہیں", "en")).toBe("roman");
  });
  it("follows clear English and keeps the previous style for very short turns", () => {
    expect(replyLanguage("What are your timings today", "roman")).toBe("en");
    expect(replyLanguage("Ali Raza", "roman")).toBe("roman");
    expect(replyLanguage("yes", "en")).toBe("en");
  });
  it("detects Urdu script", () => {
    expect(hasUrduScript("ہاں")).toBe(true);
    expect(hasUrduScript("haan")).toBe(false);
  });
});

describe("Urdu script to Latin words", () => {
  it("maps known words and Urdu digits, passes Latin through", () => {
    expect(urduToLatin("ڈاکٹر کی فیس کتنی ہے؟")).toBe("doctor ki fee kitni hai");
    expect(urduToLatin("۰۳۰۰ ۱۲۳")).toBe("0300 123");
    expect(urduToLatin("cbc price")).toBe("cbc price");
  });
});

describe("voice picker", () => {
  const edge = [
    v("Microsoft Uzma Online (Natural) - Urdu (Pakistan)", "ur-PK"),
    v("Microsoft Neerja Online (Natural) - English (India)", "en-IN"),
    v("Microsoft Prabhat Online (Natural) - English (India)", "en-IN"),
    v("Microsoft Zira - English (United States)", "en-US", true),
    v("Microsoft David - English (United States)", "en-US", true),
  ];
  it("prefers a natural female voice by default and a male one on request", () => {
    expect(pickVoice(edge, { lang: "roman", listen: "en", gender: "female" }).voice?.name).toContain("Neerja");
    expect(pickVoice(edge, { lang: "roman", listen: "en", gender: "male" }).voice?.name).toContain("Prabhat");
  });
  it("falls back to a local voice when no natural voice exists", () => {
    const plain = [v("Microsoft David - English (United States)", "en-US", true), v("Microsoft Zira - English (United States)", "en-US", true)];
    expect(pickVoice(plain, { lang: "en", listen: "en", gender: "female" }).voice?.name).toContain("Zira");
  });
  it("reports a missing Urdu voice only when the caller chose Urdu", () => {
    const noUrdu = edge.slice(1);
    expect(pickVoice(noUrdu, { lang: "roman", listen: "ur", gender: "female" }).urduVoiceMissing).toBe(true);
    expect(pickVoice(noUrdu, { lang: "roman", listen: "en", gender: "female" }).urduVoiceMissing).toBe(false);
    expect(pickVoice(edge, { lang: "roman", listen: "ur", gender: "female" }).urduVoiceMissing).toBe(false);
  });
  it("returns no voice (but a language tag) when the device has none", () => {
    const none = pickVoice([], { lang: "en", listen: "en", gender: "female" });
    expect(none.voice).toBeNull();
    expect(none.langTag).toBe("en-GB");
  });
  it("guesses gender from known names and leaves unknown names open", () => {
    expect(voiceGender(v("Microsoft Aria Online (Natural) - English (United States)", "en-US"))).toBe("female");
    expect(voiceGender(v("Google UK English Male", "en-GB"))).toBe("male");
    expect(voiceGender(v("Google हिन्दी", "hi-IN"))).toBeNull();
  });
});
