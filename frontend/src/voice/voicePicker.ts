// Chooses the best device voices (Feature 013, research R2). Edge's free "Natural" / "Online" neural voices come
// first: Uzma and Asad for Urdu, Aria or Jenny and Guy or Andrew for English. An Urdu voice reads the greetings and
// Roman Urdu sentences, an English voice the English ones, and a missing voice falls back gracefully.

import type { ListenLang, VoiceGender, VoiceInfo, VoiceLang } from "./types";

const FEMALE = new Set(
  "aria jenny ava jane nancy sonia libby maisie neerja uzma zira hazel susan catherine samantha karen moira tessa fiona veena heera kalpana natasha clara emma michelle ana sara sabina eva elsa amy ivy joanna kimberly salli kendra".split(" "),
);
const MALE = new Set("guy andrew steffan ryan davis mark david george james ravi prabhat asad salman daniel alex fred thomas liam eric brian christopher roger rishi hemant sean tony jason".split(" "));

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

// --- Per-sentence choice (the warm, natural voice) ----------------------------------------------------

// The voices that sound best, by their own first name: Edge's free neural voices.
const PREFERRED: Record<VoiceGender, string[]> = { female: ["aria", "jenny", "ava", "emma"], male: ["guy", "andrew", "brian", "christopher"] };
const ENGLISH_ORDER = ["en-us", "en-gb", "en-in", "en-pk", "en"];

const isNatural = (voice: VoiceInfo): boolean => /natural|online/i.test(voice.name);
const firstName = (voice: VoiceInfo): string => voice.name.toLowerCase().replace(/^\S+\s+/, "").replace(/online|natural|\(.*?\)|- .*$/g, " ").split(/[^a-z]+/).find(Boolean) ?? "";

function best(voices: VoiceInfo[], score: (v: VoiceInfo) => number): VoiceInfo | null {
  let top: { voice: VoiceInfo; score: number } | null = null;
  for (const voice of voices) {
    const s = score(voice);
    if (s > 0 && (!top || s > top.score)) top = { voice, score: s };
  }
  return top?.voice ?? null;
}

export type VoiceSet = {
  /** Reads English sentences: a natural English voice (Aria or Jenny, Guy or Andrew when present). */
  english: VoiceInfo | null;
  /** Reads Roman Urdu sentences and greetings: a natural Urdu voice (Uzma, Asad) when the device has one. */
  urdu: VoiceInfo | null;
  /** When there is no Urdu voice, Roman Urdu is read by the English voice that suits it best (Indian English). */
  romanFallback: VoiceInfo | null;
};

export function pickVoiceSet(voices: VoiceInfo[], gender: VoiceGender): VoiceSet {
  const genderScore = (v: VoiceInfo) => {
    const g = voiceGender(v);
    return g === gender ? 25 : g !== null ? -40 : 0;
  };
  const english = best(voices.filter((v) => v.lang.toLowerCase().startsWith("en")), (v) => {
    const rank = langRank(v.lang, ENGLISH_ORDER);
    const preferred = PREFERRED[gender].indexOf(firstName(v));
    return rank * 20 + (isNatural(v) ? 80 : 0) + (preferred >= 0 ? 40 - preferred * 5 : 0) + genderScore(v) + (v.local ? 1 : 0) + 100;
  });
  const urdu = best(voices.filter((v) => v.lang.toLowerCase().startsWith("ur")), (v) => 100 + (isNatural(v) ? 80 : 0) + (v.lang.toLowerCase() === "ur-pk" ? 10 : 0) + genderScore(v));
  const romanFallback = best(voices.filter((v) => v.lang.toLowerCase().startsWith("en")), (v) => langRank(v.lang, LANG_ORDER.roman) * 20 + (isNatural(v) ? 80 : 0) + genderScore(v) + 100);
  return { english, urdu, romanFallback };
}

export type VoiceChoice = {
  voice: VoiceInfo | null;
  /** The language tag for the utterance (so the browser still picks a sensible voice when none is chosen). */
  langTag: string;
  /** The sentence will be read by an Urdu voice, so Roman Urdu words are rewritten into Urdu script first. */
  urduScript: boolean;
};

/** The voice for one sentence. `override` is a voice the person picked in the Voice menu: it reads everything. */
export function chooseVoice(set: VoiceSet, sentenceIsRomanUrdu: boolean, override: VoiceInfo | null): VoiceChoice {
  if (override) return { voice: override, langTag: override.lang, urduScript: override.lang.toLowerCase().startsWith("ur") && sentenceIsRomanUrdu };
  if (sentenceIsRomanUrdu) {
    if (set.urdu) return { voice: set.urdu, langTag: set.urdu.lang, urduScript: true };
    const fallback = set.romanFallback ?? set.english;
    return { voice: fallback, langTag: fallback?.lang ?? "en-IN", urduScript: false };
  }
  const voice = set.english ?? set.romanFallback;
  return { voice, langTag: voice?.lang ?? "en-GB", urduScript: false };
}

/** The voices worth offering in the Voice menu (English, Urdu, Hindi), natural ones first. */
export function menuVoices(voices: VoiceInfo[]): VoiceInfo[] {
  const wanted = voices.filter((v) => /^(en|ur|hi)/i.test(v.lang));
  return [...wanted].sort((a, b) => Number(isNatural(b)) - Number(isNatural(a)) || a.lang.localeCompare(b.lang) || a.name.localeCompare(b.name));
}

/** "Microsoft Aria Online (Natural) - English (United States)" -> "Aria (Natural), English (United States)" */
export function voiceLabel(voice: VoiceInfo): string {
  const detail = /-\s*(.+)$/.exec(voice.name)?.[1];
  const name = voice.name.replace(/^\S+\s+/, "").replace(/\s*-\s*.+$/, "").replace(/\s*\(natural\)/i, "").replace(/\s*online/i, "").trim();
  return `${name}${isNatural(voice) ? " (Natural)" : ""}, ${detail ?? voice.lang}`;
}
