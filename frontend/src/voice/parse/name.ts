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

// Words that mean the candidate is a sentence, not a name ("I am looking for a doctor", "main kal aaunga").
const NOT_A_NAME = new Set(
  "looking here calling trying fine good great sick ill not having feeling going want need needs interested patient new old a an the for to with from in at on doctor dr appointment booking book please ok okay sure yes no and my is am are was ke ki ka ko se mein jana jaana chahta chahti hoon aaunga aaungi bimar bimaar theek kal aaj abhi bohat bahut dard bukhar aana aani lena leni milna milni hai hain kar karna karni dikhana dikhani".split(" "),
);

const INTROS: RegExp[] = [
  /(?:my name is|my name's|name is|this is|i am|i'm|im)\s+([^,.;!?]+)/i,
  /(?:mera naam|meraa naam|mera name|apna naam)\s+([^,.;!?]+?)(?:\s+(?:hai|hy|he))?\s*(?:[,.;!?]|$)/i,
  /\bmain\s+([^,.;!?]+?)\s+(?:hoon|hun|bol raha hoon|bol rahi hoon)\b/i,
];

const looksLikeName = (candidate: string): boolean => {
  const words = candidate.toLowerCase().split(/\s+/).filter(Boolean);
  return words.length >= 1 && words.length <= 4 && !words.some((w) => NOT_A_NAME.has(w));
};

/**
 * A name from one utterance. With `asked` (the caller was just asked for their name) a bare answer such as
 * "Ali Raza" is accepted; otherwise only an introduction ("my name is …", "mera naam … hai") counts.
 */
export function extractName(text: string, asked: boolean): string | null {
  for (const pattern of INTROS) {
    const found = pattern.exec(text);
    if (!found?.[1]) continue;
    const name = cleanName(found[1].replace(TRAILING, ""));
    if (name && looksLikeName(name)) return name;
  }
  if (!asked) return null;
  const words = text.trim().replace(/[,.!?]+/g, " ").split(/\s+/).filter(Boolean);
  const kept = words.filter((w) => !FILLER_WORDS.has(w.toLowerCase()));
  if (kept.length === 0 || kept.length > 4) return null;
  const name = cleanName(kept.join(" "));
  return name && looksLikeName(name) ? name : null;
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
