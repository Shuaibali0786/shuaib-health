// Turns a reply into short spoken chunks, and reads numbers the way a receptionist would (Feature 013).
// Short chunks start speaking sooner (first words under 2 s) and let a barge-in stop between sentences.

const ABBREVIATIONS = /\b(?:Dr|Mr|Mrs|Ms|Prof|St|vs|No|approx)\.$/i;
const MAX_CHUNK = 180;

/** Plain speech: no links, no markdown, no emoji, one space between words. */
export function toSpeakable(text: string): string {
  return text
    .replace(/https?:\/\/\S+/g, "")
    .replace(/[*_`#>]+/g, "")
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, "")
    .replace(/\s*[|•·]\s*/g, ", ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Splits at sentence ends (. ! ? ۔ ؟), but not after "Dr." or inside "11.30"; long sentences split at commas. */
export function splitSentences(text: string, max = MAX_CHUNK): string[] {
  const clean = toSpeakable(text);
  if (!clean) return [];
  const parts: string[] = [];
  let current = "";
  for (const word of clean.split(" ")) {
    current = current ? `${current} ${word}` : word;
    const ends = /[.!?۔؟]$/.test(word) && !ABBREVIATIONS.test(word);
    if (ends) {
      parts.push(current);
      current = "";
    }
  }
  if (current) parts.push(current);
  return parts.flatMap((part) => breakLong(part, max));
}

function breakLong(sentence: string, max: number): string[] {
  if (sentence.length <= max) return [sentence];
  const pieces = sentence.split(/(?<=[,;:])\s+/);
  const out: string[] = [];
  let current = "";
  for (const piece of pieces) {
    if (current && `${current} ${piece}`.length > max) {
      out.push(current);
      current = piece;
    } else {
      current = current ? `${current} ${piece}` : piece;
    }
  }
  if (current) out.push(current);
  // A single piece may still be too long (no commas): cut at a space.
  return out.flatMap((piece) => {
    if (piece.length <= max) return [piece];
    const cut = piece.lastIndexOf(" ", max);
    const at = cut > 40 ? cut : max;
    return [piece.slice(0, at).trim(), ...breakLong(piece.slice(at).trim(), max)].filter(Boolean);
  });
}

const DIGIT_WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"];

/** "+923001234567" -> "0300 123 4567" (what the card shows). Anything else is returned unchanged. */
export function groupPhone(e164: string): string {
  const m = /^\+92(3\d{9})$/.exec(e164);
  if (!m?.[1]) return e164;
  const local = `0${m[1]}`;
  return `${local.slice(0, 4)} ${local.slice(4, 7)} ${local.slice(7)}`;
}

/** The phone number spoken digit by digit in groups: "zero three zero zero, one two three, four five six seven". */
export function speakPhone(e164: string): string {
  return groupPhone(e164)
    .split(" ")
    .map((group) => [...group].map((d) => DIGIT_WORDS[Number(d)] ?? d).join(" "))
    .join(", ");
}

/** A booking reference spoken character by character in groups of four: "7, K, 3, M. 9, P, 2, Q. X, A". */
export function speakReference(reference: string): string {
  const groups = reference.match(/.{1,4}/g) ?? [];
  return groups.map((group) => [...group].join(", ")).join(". ");
}

/** The reference for the eye: "7K3M 9P2Q XA". */
export function groupReference(reference: string): string {
  return (reference.match(/.{1,4}/g) ?? [reference]).join(" ");
}

/** An email spoken the way people say it: "ali dot raza at gmail dot com". */
export function speakEmail(email: string): string {
  return email.replace(/@/g, " at ").replace(/\./g, " dot ").replace(/_/g, " underscore ").replace(/-/g, " dash ").replace(/\s+/g, " ").trim();
}
