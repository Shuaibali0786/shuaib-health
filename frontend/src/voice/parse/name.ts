// Names, emails and reasons said aloud (Feature 013). Free text is never trusted: the same rules as the
// website form apply (letters only for a name, an email shape, at most 300 characters for a reason).

const NAME_CHARS = /^[\p{L}\p{M} .'’-]+$/u;
const EMAIL_SHAPE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

const FILLER_WORDS = new Set("ji jee haan han yes yeah sure okay ok so um uh well hello hi salam assalam alaikum aoa please plz sir madam mera meri naam name is my i am im main hoon hun hai from this".split(" "));
const TRAILING = /\s+(hai|hoon|hun|hain|please|plz|sir|madam|bol raha hoon|bol rahi hoon|speaking)\s*$/i;

const titleCase = (s: string) => s.replace(/\b(\p{L})(\p{L}*)/gu, (_, a: string, b: string) => a.toUpperCase() + b.toLowerCase());

/** The name, checked with the website rule, or null. */
export function cleanName(raw: string): string | null {
  const name = titleCase(raw.trim().replace(/\s+/g, " ").replace(/[,.!?]+$/g, ""));
  return name.length >= 2 && name.length <= 80 && NAME_CHARS.test(name) && /\p{L}{2}/u.test(name) ? name : null;
}

const INTRO = /(?:my name is|my name's|name is|i am|i'm|im|this is|mera naam|meraa naam|naam|main)\s+([^,.;!?]+)/i;

/**
 * A name from one utterance. With `asked` (the caller was just asked for their name) a bare answer such as
 * "Ali Raza" is accepted; otherwise only an introduction ("my name is …", "mera naam … hai") counts.
 */
export function extractName(text: string, asked: boolean): string | null {
  const intro = INTRO.exec(text);
  if (intro?.[1]) {
    const stripped = intro[1].replace(TRAILING, "").replace(/\s+(hai|hoon|hun)$/i, "");
    const name = cleanName(stripped);
    if (name && name.split(" ").length <= 5) return name;
  }
  if (!asked) return null;
  const words = text.trim().replace(/[,.!?]+/g, " ").split(/\s+/).filter(Boolean);
  const kept = words.filter((w) => !FILLER_WORDS.has(w.toLowerCase()));
  if (kept.length === 0 || kept.length > 5) return null;
  return cleanName(kept.join(" "));
}

const DIGIT_WORD: Record<string, string> = { zero: "0", one: "1", two: "2", three: "3", four: "4", five: "5", six: "6", seven: "7", eight: "8", nine: "9" };

/** An email said aloud ("ali dot raza at gmail dot com", "at the rate"), or typed. Null when it has no email shape. */
export function extractEmail(text: string): string | null {
  const typed = /[^\s@]+@[^\s@]+\.[^\s@]+/.exec(text);
  if (typed && EMAIL_SHAPE.test(typed[0].replace(/[,;]+$/, ""))) return typed[0].replace(/[,;]+$/, "").toLowerCase();
  const spoken = text
    .toLowerCase()
    .replace(/\bat the rate( of)?\b/g, "@")
    .replace(/\bat\b/g, "@")
    .replace(/\bdot\b/g, ".")
    .replace(/\b(underscore|under score)\b/g, "_")
    .replace(/\b(dash|hyphen|minus)\b/g, "-")
    .split(/\s+/)
    .map((w) => DIGIT_WORD[w] ?? w)
    .join("")
    .replace(/[,;]+$/, "");
  const found = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/.exec(spoken);
  return found && EMAIL_SHAPE.test(found[0]) && found[0].length <= 254 ? found[0] : null;
}

const SKIP = /^(?:no|nahi|nahin|skip|none|nothing|no email|email nahi|koi nahi|nahi hai|i don'?t have|dont have|don'?t have one|not now|baad mein|rehne do|chhor do|chor do)\b/i;

/** True when the caller declines an optional question ("skip", "nahi", "no email"). */
export const declines = (text: string): boolean => SKIP.test(text.trim());

/** The reason for the visit: the caller's own words, trimmed to the website limit. */
export function cleanReason(text: string): string | null {
  const reason = text.trim().replace(/\s+/g, " ").slice(0, 300);
  return reason.length >= 2 ? reason : null;
}
