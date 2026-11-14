// Makes one sentence sound natural when a voice reads it aloud (Feature 013). The caption and the chat keep the
// original text; only what is spoken changes. Voices read "PKR 2,000", "Mon–Sat" and "+92 21 0000 0001" badly
// (as letters, as a missing dash, as a huge number), so they are rewritten the way a receptionist would say them.

const DIGIT_WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"];

const DAYS: Record<string, string> = { Mon: "Monday", Tue: "Tuesday", Wed: "Wednesday", Thu: "Thursday", Fri: "Friday", Sat: "Saturday", Sun: "Sunday" };

/** "+92 21 0000 0001" -> "plus nine two, two one, zero zero zero zero, zero zero zero one" */
function spellNumber(match: string): string {
  return match
    .trim()
    .split(/[\s-]+/)
    .map((group) => [...group].map((ch) => (ch === "+" ? "plus" : (DIGIT_WORDS[Number(ch)] ?? ch))).join(" "))
    .join(", ");
}

/**
 * What is never read aloud: links (they stay as buttons in the chat), markdown, and price footnotes such as
 * "(sample price)" that are for reading, not hearing.
 */
export function speakable(sentence: string): string {
  return sentence
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/\bhttps?:\/\/\S+/gi, " ")
    .replace(/\bwww\.\S+/gi, " ")
    .replace(/(^|\s)\/[a-z0-9][\w/-]*(?=[\s.,;!?]|$)/gi, "$1")
    .replace(/\s*\((?:all |sab )?sample(?: price| prices| qeemat| qeematein)?\)/gi, "")
    .replace(/\*\*|__|`+/g, "")
    .replace(/^\s*(?:[-*•]|\d+\.)\s+/gm, "")
    .replace(/\s+/g, " ")
    .trim();
}

// How an English voice should SAY our Urdu names (owner test 2026-11-09: "Ayesha" came out as "Alisha"). Only what
// the voice speaks changes; the screen keeps the real spelling. Syllables with hyphens make English voices (Chrome on
// Windows and Android, Safari) stress them the Urdu way.
const PRONOUNCE: Array<[RegExp, string]> = [
  [/\bAyesha\b/g, "Aa-ee-sha"],
  [/\bShuaib\b/g, "Shoo-aib"],
  [/\bMaryam\b/g, "Mar-yam"],
  [/\bZainab\b/g, "Zay-nab"],
  [/\bBaloch\b/g, "Ba-loach"],
  [/\bMemon\b/g, "May-mon"],
  [/\bQureshi\b/g, "Ku-ray-shee"],
  [/\bFarooqui\b/g, "Fa-roo-kee"],
  [/\bChaudhry\b/g, "Chau-dhree"],
  [/\bAnsari\b/g, "An-saa-ree"],
  [/\bBilal\b/g, "Bi-laal"],
  [/\bImran\b/g, "Im-raan"],
  [/\bRahman\b/g, "Reh-maan"],
  [/\bMirza\b/g, "Mir-za"],
  [/\bHassan\b/g, "Has-san"],
  [/\bSiddiqui\b/g, "Sid-dee-kee"],
];

/** The text an ENGLISH voice reads, with our Urdu names spelled the way they should sound (screen text unchanged). */
export function pronounce(text: string): string {
  return PRONOUNCE.reduce((out, [name, sound]) => out.replace(name, sound), text);
}

export function forSpeech(sentence: string): string {
  return speakable(sentence)
    .replace(/\+?\d{2,}(?:[\s-]\d{2,}){2,}/g, spellNumber)
    .replace(/\bPKR\s*(\d[\d,]*)/g, "$1 rupees")
    .replace(/\bPKT\b/g, "Pakistan time")
    .replace(/\b(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\b(?!\w)/g, (day) => DAYS[day] ?? day)
    .replace(/\s*[–—]\s*/g, " to ")
    .replace(/…/g, ".")
    .replace(/[→←•·|~^<>{}[\]*_#]/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .trim();
}
