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

export function forSpeech(sentence: string): string {
  return sentence
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
