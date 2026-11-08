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
const REPEAT: Record<string, number> = { double: 2, triple: 3, dabal: 2, tripal: 3 };

/** Every digit heard, in order (digit characters and digit words; "double five" is 55). */
export function spokenDigits(text: string): string {
  const tokens = text
    .toLowerCase()
    .replace(/\+/g, " plus ")
    .replace(/[,.\-()·]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  let out = "";
  let repeat = 1;
  for (const token of tokens) {
    if (token === "plus") {
      out += "+";
      continue;
    }
    if (token in REPEAT) {
      repeat = REPEAT[token] ?? 1;
      continue;
    }
    const digits = /^\d+$/.test(token) ? token : (WORD_DIGITS[token] ?? "");
    if (digits) {
      out += digits.length === 1 ? digits.repeat(repeat) : digits;
      repeat = 1;
    }
  }
  return out;
}

export type PhoneHeard =
  | { status: "complete"; e164: string }
  | { status: "partial"; digits: string }
  | { status: "invalid"; digits: string }
  | { status: "none" };

const STARTS_A_NUMBER = /^(\+?92|0092|03)/;

/**
 * Reads a phone number from one utterance. `partial` is what an earlier, incomplete try produced, so the
 * caller only repeats the rest. A fresh number (starting 03 or +92) replaces the partial one.
 */
export function extractPhone(text: string, partial = ""): PhoneHeard {
  const heard = spokenDigits(text).replace(/(?!^)\+/g, "");
  const digits = heard.replace(/\+/g, "");
  if (digits.length < 2) return { status: "none" };
  const alone = normalizePkMobile(heard);
  if (alone) return { status: "complete", e164: alone };
  const restart = STARTS_A_NUMBER.test(heard.replace("+", "")) && digits.length >= 4;
  const joined = restart || !partial ? digits : partial + digits;
  const combined = normalizePkMobile(joined);
  if (combined) return { status: "complete", e164: combined };
  if (joined.length > 13) return { status: "invalid", digits: joined };
  // A full-length number that is not a mobile number (for example a landline) is wrong, not partial.
  if (joined.length >= 11) return { status: "invalid", digits: joined };
  return { status: "partial", digits: joined };
}
