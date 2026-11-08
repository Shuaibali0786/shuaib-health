// Fixed phrases of the voice receptionist, in English and simple Roman Urdu (Feature 013, Phase 1).
// Warm Pakistani phrasing, short sentences, the caller's name when known.

import type { KnowledgePack } from "@/agent/types";

import type { VoiceLang } from "./types";

export const T = (lang: VoiceLang, en: string, roman: string): string => (lang === "roman" ? roman : en);

/** The short, warm welcome (once per conversation). "Audio is never recorded" is shown as small text, not spoken. */
export function welcomeLine(pack: KnowledgePack, lang: VoiceLang): string {
  const clinic = pack.clinic.name;
  return T(
    lang,
    `Welcome to ${clinic}! I'm your AI assistant. How can I help you today?`,
    `Assalam o Alaikum! ${clinic} mein khush aamdeed. Main aap ki AI assistant hoon, bataiye kya madad karoon?`,
  );
}

export const CHECKING = (lang: VoiceLang): string => T(lang, "One moment, checking…", "Ji, dekh rahi hoon…");

export const STILL_THERE = (lang: VoiceLang): string => T(lang, "Are you still there? I'm listening.", "Kya aap abhi hain? Main sun rahi hoon.");
export const TAP_TO_TALK = (lang: VoiceLang): string => T(lang, "I've stopped listening. Tap the mic when you're ready.", "Maine sunna band kar diya hai. Jab tayyar hon, mic dabaiye.");

export const NOT_UNDERSTOOD = (lang: VoiceLang): string => T(lang, "Sorry, I didn't catch that. Could you say it again?", "Maaf kijiye, main samajh nahi saki. Dobara bata dein?");

export const DONT_KNOW = (pack: KnowledgePack, lang: VoiceLang): string =>
  T(
    lang,
    `I don't know that one, and I won't guess. Please contact the clinic on ${pack.clinic.phone}.`,
    `Yeh mujhe nahi maloom, aur main andaza nahi lagaungi. Barah-e-meherbani clinic se ${pack.clinic.phone} par rabta karein.`,
  );
