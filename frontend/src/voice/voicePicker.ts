// Chooses the best device voice (Feature 013, research R2). Edge's "Natural" / "Online" voices come first.
// Phase 1 speaks English and Roman Urdu with an English voice (en-IN suits Roman Urdu best); Urdu-script
// replies and Urdu voices are Phase 2, so a missing Urdu voice only changes what we tell the caller.

import type { ListenLang, VoiceGender, VoiceInfo, VoiceLang } from "./types";

const FEMALE = new Set(
  "aria jenny sonia libby maisie neerja uzma zira hazel susan catherine samantha karen moira tessa fiona veena heera kalpana natasha clara emma michelle ana sara sabina eva elsa amy ivy joanna kimberly salli kendra".split(" "),
);
const MALE = new Set("guy ryan davis mark david george james ravi prabhat asad salman daniel alex fred thomas liam eric brian christopher roger rishi hemant sean tony jason".split(" "));

export function voiceGender(voice: VoiceInfo): VoiceGender | null {
  // Drop the maker's name (the first word) and the descriptive words, leaving the voice's own first name.
  const words = voice.name.toLowerCase().replace(/^\S+\s+/, "").replace(/online|natural|\(.*?\)|- .*$/g, " ").split(/[^a-z]+/).filter(Boolean);
  if (words.some((w) => FEMALE.has(w)) || /\bfemale\b/i.test(voice.name)) return "female";
  if (words.some((w) => MALE.has(w)) || /\bmale\b/i.test(voice.name)) return "male";
  return null;
}

/** Language tags to prefer, best first. Roman Urdu reads best with Indian English; English with a close accent. */
const LANG_ORDER: Record<VoiceLang, string[]> = {
  roman: ["en-in", "en-pk", "en-gb", "en-us", "en"],
  en: ["en-pk", "en-in", "en-gb", "en-us", "en"],
};

function langRank(lang: string, order: string[]): number {
  const tag = lang.toLowerCase().replace("_", "-");
  const exact = order.indexOf(tag);
  if (exact >= 0) return order.length - exact;
  const base = order.indexOf(tag.split("-")[0] ?? "");
  return base >= 0 ? Math.max(1, order.length - base - 1) : 0;
}

export type VoicePick = {
  voice: VoiceInfo | null;
  /** The language tag to put on the utterance, so the browser picks a sensible default when no voice is chosen. */
  langTag: string;
  /** The caller chose Urdu but this device has no Urdu voice (we say so once, politely). */
  urduVoiceMissing: boolean;
};

export function pickVoice(voices: VoiceInfo[], options: { lang: VoiceLang; listen: ListenLang; gender: VoiceGender }): VoicePick {
  const order = LANG_ORDER[options.lang];
  let best: { voice: VoiceInfo; score: number } | null = null;
  for (const voice of voices) {
    const rank = langRank(voice.lang, order);
    if (rank === 0) continue;
    const gender = voiceGender(voice);
    let score = rank * 100;
    if (/natural|online/i.test(voice.name)) score += 60;
    if (gender === options.gender) score += 25;
    else if (gender !== null) score -= 40;
    if (voice.local) score += 2;
    if (!best || score > best.score) best = { voice, score };
  }
  const hasUrdu = voices.some((v) => v.lang.toLowerCase().startsWith("ur"));
  return {
    voice: best?.voice ?? null,
    langTag: best?.voice.lang ?? (options.lang === "roman" ? "en-IN" : "en-GB"),
    urduVoiceMissing: options.listen === "ur" && !hasUrdu,
  };
}
