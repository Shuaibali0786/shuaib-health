// Fixed phrases of the voice receptionist, in English and simple Roman Urdu (Feature 013, Phase 1).
// Warm Pakistani phrasing, short sentences, the caller's name when known.

import type { KnowledgePack } from "@/agent/types";

import type { VoiceLang } from "./types";

export const T = (lang: VoiceLang, en: string, roman: string): string => (lang === "roman" ? roman : en);

/** The receptionist's name (owner decision 2026-11-09). The panel's subtitle still says she is an AI. */
export const ASSISTANT_NAME = "Ayesha";

/** The short, warm welcome (once per conversation). "Audio is never recorded" is shown as small text, not spoken. */
export function welcomeLine(pack: KnowledgePack, lang: VoiceLang): string {
  const clinic = pack.clinic.name;
  return T(
    lang,
    `Hi, welcome to ${clinic}! I'm ${ASSISTANT_NAME}, your virtual assistant. How are you today?`,
    `Assalam o Alaikum! ${clinic} mein khush aamdeed, main ${ASSISTANT_NAME} hoon, aap ki virtual assistant. Aap kaise hain?`,
  );
}

export const CHECKING = (lang: VoiceLang): string => T(lang, "Just one moment while I check.", "Ji, ek lamha, main dekh rahi hoon.");

/**
 * Calm, reassuring words when a patient names an illness or pain (owner: never "Mujhe sun kar afsos hua"). Varied, so
 * two problems in one call never get the same line; `seed` picks one deterministically.
 */
export function reassure(lang: VoiceLang, seed: string): string {
  const en = ["I'm sorry you're not feeling well. Let's get you seen quickly.", "Don't worry, I'll help you right away.", "I understand. Let's get you to the right doctor."];
  const roman = ["Ji, fikar na karein, main abhi aap ki madad karti hoon.", "Aap fikar na karein, hum aap ka achhi tarah khayal rakhenge.", "Ji, main samajh gayi. Fikar na karein, abhi intezam karti hoon."];
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const list = lang === "roman" ? roman : en;
  return list[h % list.length] as string;
}

export const STILL_THERE = (lang: VoiceLang): string => T(lang, "Are you still there? I'm listening.", "Kya aap abhi hain? Main sun rahi hoon.");
export const TAP_TO_TALK = (lang: VoiceLang): string => T(lang, "I've stopped listening. Tap the mic when you're ready.", "Maine sunna band kar diya hai. Jab tayyar hon, mic dabaiye.");

export const NOT_UNDERSTOOD = (lang: VoiceLang): string => T(lang, "Sorry, I didn't catch that. Could you say it again?", "Maaf kijiye, main samajh nahi saki. Dobara bata dein?");

export const DONT_KNOW = (pack: KnowledgePack, lang: VoiceLang): string =>
  T(
    lang,
    `I don't know that one, and I won't guess. Please contact the clinic on ${pack.clinic.phone}.`,
    `Yeh mujhe nahi maloom, aur main andaza nahi lagaungi. Barah-e-meherbani clinic se ${pack.clinic.phone} par rabta karein.`,
  );
