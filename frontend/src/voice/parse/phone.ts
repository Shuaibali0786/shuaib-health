// Spoken phone numbers (Feature 013): "zero three zero zero, double five, one two three" and Roman Urdu digit
// words. The number is then checked with the website's own rule (lib/booking/phone.ts).

import { normalizePkMobile } from "@/lib/booking/phone";

const WORD_DIGITS: Record<string, string> = {
  zero: "0", oh: "0", sifar: "0", siphr: "0",
  one: "1", ek: "1", aik: "1",
  two: "2", do: "2",
  three: "3", teen: "3", tin: "3",
  four: "4", char: "4", chaar: "4",
  five: "5", panch: "5", paanch: "5",
  six: "6", chay: "6", chhe: "6", chheh: "6",
  seven: "7", saat: "7",
  eight: "8", aath: "8",
  nine: "9", nau: "9",
};
const REPEAT: Record<string, number> = { double: 2, triple: 3, dabal: 2, tripal: 3, dubal: 2, tripple: 3 };

// Only while the mobile number is being asked: how Chrome mishears spoken digits (owner's real test, 2026-11-09:
// "zero Thi two four five two double S Fa Ti Fa", "Z T2 Ffa2d6353") and more Urdu digit words. Outside that
// question these words keep their ordinary meaning ("to", "for", "do").
const FUZZY_DIGITS: Record<string, string> = {
  z: "0", zee: "0", zed: "0", ziro: "0", zeero: "0", jero: "0", sifr: "0", o: "0",
  won: "1", wan: "1", ik: "1",
  to: "2", too: "2", tu: "2", tow: "2",
  thi: "3", tree: "3", ti: "3", tee: "3", t: "3", thri: "3", tri: "3", thre: "3",
  for: "4", fore: "4", foor: "4", faur: "4",
  fa: "5", faio: "5", faiv: "5", fife: "5", faive: "5", fiv: "5", fai: "5", faiy: "5",
  s: "6", siks: "6", sics: "6", sicks: "6", che: "6", chhey: "6",
  sevan: "7", sat: "7",
  ate: "8", ait: "8", aat: "8",
  nain: "9", nein: "9", nyne: "9", nao: "9",
};
// Words that are also ordinary words: a digit only next to another digit ("bata do" is not a 2).
const WEAK = new Set(["do", "to", "too", "tu", "for", "fore", "won", "ate", "o", "oh", "s", "t", "z", "ti", "sat", "che"]);

/** "ffa" is "fa", "tree" is "tre": letters said twice in a row by the recogniser. */
const squeeze = (word: string) => word.replace(/(.)\1+/g, "$1");

type Token = { kind: "digits"; value: string; weak: boolean } | { kind: "repeat"; times: number } | { kind: "plus" } | { kind: "other" };

function tokenize(text: string, fuzzy: boolean): Token[] {
  const words = text
    .toLowerCase()
    .replace(/\+/g, " plus ")
    .replace(/[,.\-()·!?]/g, " ")
    // "T2", "Ffa2d6353": letters and digits run together are separate words.
    .replace(/(\d)(?=[a-z])|([a-z])(?=\d)/g, "$1$2 ")
    .split(/\s+/)
    .filter(Boolean);
  return words.map((word): Token => {
    if (word === "plus") return { kind: "plus" };
    if (/^\d+$/.test(word)) return { kind: "digits", value: word, weak: false };
    const times = REPEAT[word] ?? (fuzzy ? REPEAT[squeeze(word)] : undefined);
    if (times) return { kind: "repeat", times };
    const strict = WORD_DIGITS[word];
    if (strict) return { kind: "digits", value: strict, weak: fuzzy && WEAK.has(word) };
    if (fuzzy) {
      const loose = FUZZY_DIGITS[word] ?? WORD_DIGITS[squeeze(word)] ?? FUZZY_DIGITS[squeeze(word)];
      if (loose) return { kind: "digits", value: loose, weak: WEAK.has(word) };
    }
    return { kind: "other" };
  });
}

/**
 * Every digit heard, in order (digit characters and digit words; "double five" is 55). With `fuzzy` (only while the
 * mobile number is asked) misheard digit words count too, and a run made only of everyday words ("to", "do") does not.
 */
export function spokenDigits(text: string, options: { fuzzy?: boolean } = {}): string {
  const fuzzy = Boolean(options.fuzzy);
  const tokens = tokenize(text, fuzzy);
  // Runs of digit tokens (with "double" inside them); a run of weak words alone is not a number.
  const keep = new Array<boolean>(tokens.length).fill(true);
  if (fuzzy) {
    let start = 0;
    for (let i = 0; i <= tokens.length; i++) {
      const t = tokens[i];
      if (t && (t.kind === "digits" || t.kind === "repeat")) continue;
      const run = tokens.slice(start, i);
      // "double S" is a number too: "double" is only ever said inside one.
      if (!run.some((x) => (x.kind === "digits" && !x.weak) || x.kind === "repeat")) for (let j = start; j < i; j++) keep[j] = false;
      start = i + 1;
    }
  }
  let out = "";
  let repeat = 1;
  tokens.forEach((token, i) => {
    if (token.kind === "plus") {
      out += "+";
      return;
    }
    if (token.kind === "repeat") {
      if (keep[i]) repeat = token.times;
      return;
    }
    if (token.kind !== "digits" || !keep[i]) return;
    out += token.value.length === 1 ? token.value.repeat(repeat) : token.value;
    repeat = 1;
  });
  return out;
}

/** "Phir se", "dobara", "start again": the patient starts the number over. */
export const RESTART_NUMBER = /\b(phir se|phirse|fir se|firse|dobara|dubara|again|start over|from the start|shuru se)\b/i;

/**
 * The sentence without a spoken phone number: a run of digit words and digits that adds up to seven digits or
 * more is removed, so the rest ("book me with Dr Bilal on friday") can be read on its own.
 */
export function withoutPhone(text: string): string {
  const tokens = text.split(/(\s+)/);
  const kept: string[] = [];
  let run: string[] = [];
  let count = 0;
  const flush = () => {
    if (count < 7) kept.push(...run);
    run = [];
    count = 0;
  };
  for (const token of tokens) {
    const bare = token.toLowerCase().replace(/[,.\-()·+]/g, "");
    const digits = spokenDigits(bare).replace(/\D/g, "");
    const isDigitToken = bare !== "" && (/^\d+$/.test(bare) || bare in WORD_DIGITS || bare in REPEAT);
    if (isDigitToken) {
      run.push(token);
      count += digits.length;
    } else if (run.length > 0 && /^\s+$/.test(token)) {
      run.push(token);
    } else {
      flush();
      kept.push(token);
    }
  }
  flush();
  return kept.join("").replace(/\s+/g, " ").trim();
}

export type PhoneHeard =
  | { status: "complete"; e164: string }
  | { status: "partial"; digits: string }
  | { status: "invalid"; digits: string }
  | { status: "none" };

const STARTS_A_NUMBER = /^(\+?92|0092|03)/;
/** How a Pakistani mobile number can begin: 03…, 3… (the 0 not heard), 923… or 00923…. */
const MOBILE_STARTS = ["03", "3", "923", "00923"];

/**
 * Reads a phone number from one utterance. `partial` is what an earlier, incomplete try produced, so the
 * caller only repeats the rest. A fresh number (starting 03 or +92) replaces the partial one.
 */
export function extractPhone(text: string, partial = "", options: { fuzzy?: boolean } = {}): PhoneHeard {
  const heard = spokenDigits(text, options).replace(/(?!^)\+/g, "");
  const digits = heard.replace(/\+/g, "");
  if (digits.length < 2) return { status: "none" };
  const alone = normalizePkMobile(heard) ?? (/^3\d{9}$/.test(digits) ? normalizePkMobile(`0${digits}`) : null);
  if (alone) return { status: "complete", e164: alone };
  // A new try (it starts with 0 or +92, or "phir se"), or one that would make the number too long, replaces the
  // earlier partial number instead of piling onto it ("0032" + "40245" was the owner's real test).
  const restart =
    (STARTS_A_NUMBER.test(heard.replace("+", "")) && digits.length >= 4) ||
    (options.fuzzy && (digits.startsWith("0") || RESTART_NUMBER.test(text))) ||
    partial.length + digits.length > 11;
  const joined = restart || !partial ? digits : partial + digits;
  const combined = normalizePkMobile(joined) ?? (/^3\d{9}$/.test(joined) ? normalizePkMobile(`0${joined}`) : null);
  if (combined) return { status: "complete", e164: combined };
  if (joined.length > 13) return { status: "invalid", digits: joined };
  // A full-length number that is not a mobile number (for example a landline) is wrong, not partial.
  if (joined.length >= 11) return { status: "invalid", digits: joined };
  // Digits that cannot begin a mobile number ("0032") are wrong, not kept to pile the next try onto.
  if (!MOBILE_STARTS.some((c) => joined.startsWith(c) || c.startsWith(joined))) return { status: "invalid", digits: joined };
  return { status: "partial", digits: joined };
}
