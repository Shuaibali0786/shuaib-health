// Fixed phrases of the voice receptionist, in English and simple Roman Urdu (Feature 013, Phase 1).
// Warm Pakistani phrasing, short sentences, the caller's name when known.

import type { KnowledgePack } from "@/agent/types";

import type { VoiceLang } from "./types";

export const T = (lang: VoiceLang, en: string, roman: string): string => (lang === "roman" ? roman : en);

/** Said once at the start of a voice conversation: greeting, "I am an AI", and "audio is never recorded". */
export function openingLines(pack: KnowledgePack, lang: VoiceLang): string {
  const clinic = pack.clinic.name;
  return T(
    lang,
    `Assalam o Alaikum! I'm the voice assistant of ${clinic}. I'm an AI, and this is a demo clinic. We never record or store your audio. How can I help you today?`,
    `Assalam o Alaikum! Main ${clinic} ki voice assistant hoon. Main ek AI hoon, aur yeh ek demo clinic hai. Aap ki awaaz kabhi record ya save nahi hoti. Bataiye, main kya madad karoon?`,
  );
}

export const CHECKING = (lang: VoiceLang): string => T(lang, "Ji, checking…", "Ji, dekh rahi hoon…");

export const STILL_THERE = (lang: VoiceLang): string => T(lang, "Are you still there? I'm listening.", "Kya aap abhi hain? Main sun rahi hoon.");
export const TAP_TO_TALK = (lang: VoiceLang): string => T(lang, "I've stopped listening. Tap the microphone when you're ready.", "Maine sunna band kar diya hai. Jab tayyar hon, microphone dabaiye.");

export const NO_URDU_VOICE = (lang: VoiceLang): string =>
  T(
    lang,
    "This device has no Urdu voice, so I'll speak Roman Urdu in an English voice and show you the text.",
    "Is device mein Urdu awaaz maujood nahi, is liye main Roman Urdu English awaaz mein bolungi aur text bhi dikhaungi.",
  );

export const NOT_UNDERSTOOD = (lang: VoiceLang): string => T(lang, "Sorry, I didn't catch that. Could you say it again?", "Maaf kijiye, main samajh nahi saki. Dobara bata dein?");

export const DONT_KNOW = (pack: KnowledgePack, lang: VoiceLang): string =>
  T(
    lang,
    `I don't know that one, and I won't guess. Please contact the clinic on ${pack.clinic.phone}.`,
    `Yeh mujhe nahi maloom, aur main andaza nahi lagaungi. Barah-e-meherbani clinic se ${pack.clinic.phone} par rabta karein.`,
  );
