// Spoken dates in English and Roman Urdu (Feature 013). All dates are the clinic's own calendar days
// (Asia/Karachi, no daylight saving), as "YYYY-MM-DD", the same form the slot list uses.

const KARACHI_OFFSET_MS = 5 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

const pad = (n: number) => String(n).padStart(2, "0");
const fmt = (utcMidnight: number) => {
  const d = new Date(utcMidnight);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
};
/** Midnight UTC of the clinic's calendar day containing `now`. */
const todayMidnight = (now: Date) => Math.floor((now.getTime() + KARACHI_OFFSET_MS) / DAY_MS) * DAY_MS;

export const todayLocal = (now: Date): string => fmt(todayMidnight(now));

const WEEKDAYS: Record<string, number> = {
  sunday: 0, sun: 0, itwar: 0, aitwar: 0, ittwar: 0,
  monday: 1, mon: 1, peer: 1, pir: 1, somwar: 1,
  tuesday: 2, tue: 2, tues: 2, mangal: 2, mangel: 2,
  wednesday: 3, wed: 3, budh: 3, budhwar: 3,
  thursday: 4, thu: 4, thur: 4, thurs: 4, jumeraat: 4, jumerat: 4, jumairat: 4,
  friday: 5, fri: 5, juma: 5, jumma: 5, jumah: 5,
  saturday: 6, sat: 6, hafta: 6, haftay: 6, sanichar: 6,
};
const MONTHS: Record<string, number> = {
  january: 1, jan: 1, janwari: 1, february: 2, feb: 2, farwari: 2, march: 3, mar: 3, april: 4, apr: 4, may: 5, mai: 5,
  june: 6, jun: 6, july: 7, jul: 7, julai: 7, august: 8, aug: 8, agast: 8, september: 9, sep: 9, sept: 9, sitambar: 9,
  october: 10, oct: 10, aktoobar: 10, november: 11, nov: 11, navambar: 11, december: 12, dec: 12, disambar: 12,
};

const daysInMonth = (year: number, month: number) => new Date(Date.UTC(year, month, 0)).getUTCDate();

/** The next calendar day (today included) whose day of the month is `day`, in `month` when given. */
function dayOfMonth(day: number, month: number | null, now: Date): string | null {
  if (day < 1 || day > 31) return null;
  const today = todayMidnight(now);
  const t = new Date(today);
  const year = t.getUTCFullYear();
  const m0 = t.getUTCMonth() + 1;
  if (month !== null) {
    for (const y of [year, year + 1]) {
      if (day > daysInMonth(y, month)) continue;
      const at = Date.UTC(y, month - 1, day);
      if (at >= today) return fmt(at);
    }
    return null;
  }
  for (let i = 0; i < 13; i += 1) {
    const mm = ((m0 - 1 + i) % 12) + 1;
    const yy = year + Math.floor((m0 - 1 + i) / 12);
    if (day > daysInMonth(yy, mm)) continue;
    const at = Date.UTC(yy, mm - 1, day);
    if (at >= today) return fmt(at);
  }
  return null;
}

const NOISE = /[,.;:!?()'’]/g;

/**
 * A date from one utterance, or null. `alone` is true when the caller was just asked for the date, so a
 * bare number ("13") is accepted as the day of the month; otherwise a number needs "13th", a month, or
 * "tareekh", because "11 baje" is a time.
 */
export function parseDate(text: string, now: Date, alone = false): string | null {
  const t = text.toLowerCase().replace(NOISE, " ").replace(/\s+/g, " ").trim();
  if (!t) return null;
  const today = todayMidnight(now);

  if (/\bday after tomorrow\b|\bparson\b|\bparso\b|\bparsoon\b/.test(t)) return fmt(today + 2 * DAY_MS);
  if (/\btomorrow\b|\btmrw\b|\btomorow\b|\bkal\b/.test(t)) return fmt(today + DAY_MS);
  if (/\btoday\b|\baaj\b|\baj\b/.test(t)) return fmt(today);

  const words = t.split(" ");
  const monthIndex = words.findIndex((w) => w in MONTHS);
  const month = monthIndex >= 0 ? (MONTHS[words[monthIndex] ?? ""] ?? null) : null;

  // "13th", "13 november", "november 13", "tareekh 13", "13 tareekh", "date 13"
  const ordinal = /\b(\d{1,2})(?:st|nd|rd|th)\b/.exec(t);
  if (ordinal?.[1]) return dayOfMonth(Number(ordinal[1]), month, now);
  if (month !== null) {
    const near = [words[monthIndex - 1], words[monthIndex + 1]].find((w) => w && /^\d{1,2}$/.test(w));
    if (near) return dayOfMonth(Number(near), month, now);
  }
  const marked = /\b(?:tareekh|tarikh|date|on the)\s+(\d{1,2})\b|\b(\d{1,2})\s+(?:tareekh|tarikh|ko)\b/.exec(t);
  const markedDay = marked?.[1] ?? marked?.[2];
  if (markedDay) return dayOfMonth(Number(markedDay), month, now);

  for (const w of words) {
    const day = WEEKDAYS[w];
    if (day === undefined) continue;
    // "sat" and "sun" are also ordinary words; require a day-like context for those short forms only when not alone.
    const current = new Date(today).getUTCDay();
    const ahead = ((day - current + 7) % 7) || 7;
    return fmt(today + ahead * DAY_MS);
  }

  if (alone && /^\d{1,2}$/.test(t)) return dayOfMonth(Number(t), null, now);
  return null;
}

const LONG_DAY = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const LONG_MONTH = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** "Friday 13 November" for the card and the read-back. */
export function speakDate(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  if (!y || !m || !d) return date;
  const weekday = LONG_DAY[new Date(Date.UTC(y, m - 1, d)).getUTCDay()] ?? "";
  return `${weekday} ${d} ${LONG_MONTH[m - 1] ?? ""}`;
}

/** "11:30" -> "11:30 AM" (the clinic's patients read a 12-hour clock). */
export function speakTime(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  if (h === undefined || m === undefined) return hhmm;
  const suffix = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${pad(m)} ${suffix}`;
}
