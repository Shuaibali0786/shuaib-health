// Spoken times in English and Roman Urdu (Feature 013). A time can be 11 in the morning or 11 at night, so this
// returns every plausible 24-hour reading; the dialog keeps only those that are really free slots, and asks
// "morning or evening?" when two remain.

const WORD_HOURS: Record<string, number> = {
  one: 1, ek: 1, aik: 1, two: 2, do: 2, three: 3, teen: 3, four: 4, char: 4, chaar: 4, five: 5, panch: 5, paanch: 5,
  six: 6, chhe: 6, chay: 6, seven: 7, saat: 7, eight: 8, aath: 8, nine: 9, nau: 9, ten: 10, das: 10,
  eleven: 11, gyarah: 11, giarah: 11, twelve: 12, barah: 12, baarah: 12,
};
const WORD_MINUTES: Record<string, number> = { fifteen: 15, thirty: 30, forty: 40, "forty five": 45, fortyfive: 45 };

const pad = (n: number) => String(n).padStart(2, "0");
const hhmm = (h: number, m: number) => `${pad(h)}:${pad(m)}`;

type Marker = "am" | "pm" | null;

function marker(t: string): Marker {
  if (/\b(a\s?m|am|subah|subha|morning|savere)\b/.test(t)) return "am";
  if (/\b(p\s?m|pm|dopahar|dopehar|afternoon|shaam|sham|evening|raat|night)\b/.test(t)) return "pm";
  return null;
}

function expand(hour: number, minute: number, mark: Marker): string[] {
  if (hour < 0 || hour > 24 || minute < 0 || minute > 59) return [];
  if (hour >= 13) return hour === 24 ? [] : [hhmm(hour, minute)];
  if (hour === 0) return [hhmm(0, minute)];
  if (mark === "am") return [hhmm(hour === 12 ? 0 : hour, minute)];
  if (mark === "pm") return [hhmm(hour === 12 ? 12 : hour + 12, minute)];
  if (hour === 12) return [hhmm(12, minute)];
  return [hhmm(hour, minute), hhmm(hour + 12, minute)];
}

const MONTHS = "jan|january|feb|february|mar|march|apr|april|may|jun|june|jul|july|aug|august|sep|sept|september|oct|october|nov|november|dec|december";
const DAY_MONTH = new RegExp(`\\b\\d{1,2}(st|nd|rd|th)?\\s+(of\\s+)?(${MONTHS})\\b`, "g");
const MONTH_DAY = new RegExp(`\\b(${MONTHS})\\s+\\d{1,2}(st|nd|rd|th)?\\b`, "g");

/**
 * The sentence without its date ("13 november", "november 13th", "the 13th", "13 tareekh"), so the day of the month
 * is never read as an hour. Owner test 2026-11-09: "13 november 2 pm" was booked at 1:00 PM (13:00) without a word.
 */
export function withoutDates(t: string): string {
  return t
    .replace(DAY_MONTH, " ")
    .replace(MONTH_DAY, " ")
    .replace(/\b(the\s+)?\d{1,2}(st|nd|rd|th)\b/g, " ")
    .replace(/\b\d{1,2}\s+(tareekh|tarikh|tarik|date)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * All plausible 24-hour readings of one utterance ("11:30", "11 baje", "saade gyarah", "half past ten",
 * "3 pm", "teen baje shaam"). Empty when no time is heard. `alone` allows a bare number ("11").
 */
export function parseTimes(text: string, alone = false): string[] {
  const t = withoutDates(text.toLowerCase().replace(/[,;!?()]/g, " ").replace(/\s+/g, " ").trim());
  if (!t) return [];
  const mark = marker(t);

  // 11:30, 11.30 (not a date like 13.11), optionally with am/pm
  const clock = /\b(\d{1,2})[:.](\d{2})\b/.exec(t);
  if (clock?.[1] && clock[2]) return expand(Number(clock[1]), Number(clock[2]), mark);

  const num = (w: string | undefined): number | null => {
    if (!w) return null;
    if (/^\d{1,2}$/.test(w)) return Number(w);
    return WORD_HOURS[w] ?? null;
  };
  const words = t.split(" ");

  // Roman Urdu fractions: saade X (X:30), sawa X (X:15), paune X ((X-1):45), dhai (2:30), derh (1:30)
  for (let i = 0; i < words.length; i += 1) {
    const w = words[i];
    if (w === "dhai") return expand(2, 30, mark);
    if (w === "derh" || w === "dedh") return expand(1, 30, mark);
    const next = num(words[i + 1]);
    if (next === null) continue;
    if (w === "saade" || w === "sade" || w === "saray") return expand(next, 30, mark);
    if (w === "sawa" || w === "sawwa") return expand(next, 15, mark);
    if (w === "paune" || w === "pone") return expand(next === 1 ? 12 : next - 1, 45, mark);
  }
  // English: half past X, quarter past X, quarter to X
  const half = /\bhalf past (\w+)/.exec(t);
  if (half && num(half[1]) !== null) return expand(num(half[1]) as number, 30, mark);
  const qPast = /\bquarter past (\w+)/.exec(t);
  if (qPast && num(qPast[1]) !== null) return expand(num(qPast[1]) as number, 15, mark);
  const qTo = /\bquarter to (\w+)/.exec(t);
  if (qTo && num(qTo[1]) !== null) {
    const h = num(qTo[1]) as number;
    return expand(h === 1 ? 12 : h - 1, 45, mark);
  }
  // "eleven thirty", "ten forty five", "3 30"
  for (let i = 0; i < words.length - 1; i += 1) {
    const h = num(words[i]);
    if (h === null) continue;
    const two = `${words[i + 1]} ${words[i + 2] ?? ""}`.trim();
    const m = WORD_MINUTES[two] ?? WORD_MINUTES[words[i + 1] ?? ""] ?? (/^\d{2}$/.test(words[i + 1] ?? "") ? Number(words[i + 1]) : null);
    if (m !== null && m !== undefined && m <= 59) return expand(h, m, mark);
  }
  // "11 baje", "11 o'clock", "at 3", "3 pm", "teen baje". A number said WITH its marker wins over any other number.
  for (let i = 0; i < words.length; i += 1) {
    const h = num(words[i]);
    if (h !== null && /^(baje|bajay|bje|o'clock|oclock|am|pm|a|p)$/.test(words[i + 1] ?? "")) return expand(h, 0, mark);
  }
  for (let i = 0; i < words.length; i += 1) {
    const h = num(words[i]);
    if (h === null) continue;
    const after = words[i + 1] ?? "";
    const before = words[i - 1] ?? "";
    if (/^(baje|bajay|bje|o'clock|oclock|am|pm|a|p)$/.test(after) || mark !== null || before === "at" || before === "around" || before === "tak") {
      return expand(h, 0, mark);
    }
  }
  if (alone && words.length === 1) {
    const h = num(words[0]);
    if (h !== null) return expand(h, 0, null);
  }
  return [];
}
