import type { OpeningHoursRule, Weekday } from "@/types/content";

/**
 * Deterministic formatting. Output never depends on the runtime's ICU data or
 * the visitor's locale, so server and client renders always match.
 */

/** "PKR 2,500". Whole, non-negative rupees only. */
export function formatPkr(amount: number): string {
  if (!Number.isInteger(amount) || amount < 0) {
    throw new RangeError(`formatPkr expects a non-negative whole number, got ${amount}`);
  }
  return `PKR ${amount.toLocaleString("en-US")}`;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "12 Sep 2026", using the calendar date in Asia/Karachi, whatever the visitor's time zone. */
export function formatKarachiDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    throw new RangeError(`formatKarachiDate expects an ISO 8601 date, got "${iso}"`);
  }
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Karachi",
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(date);
  const pick = (type: "year" | "month" | "day") =>
    Number(parts.find((part) => part.type === type)?.value);
  const month = MONTHS[pick("month") - 1];
  return `${pick("day")} ${month} ${pick("year")}`;
}

const WEEKDAY_ORDER: Weekday[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const WEEKDAY_LABEL: Record<Weekday, string> = {
  mon: "Mon",
  tue: "Tue",
  wed: "Wed",
  thu: "Thu",
  fri: "Fri",
  sat: "Sat",
  sun: "Sun",
};

/** [Mon..Sat] -> "Mon–Sat", [Mon, Wed] -> "Mon, Wed", [Mon, Tue] -> "Mon, Tue". */
function formatDays(days: Weekday[]): string {
  const indexes = [...new Set(days.map((day) => WEEKDAY_ORDER.indexOf(day)))].sort((a, b) => a - b);
  const runs: number[][] = [];
  for (const index of indexes) {
    const last = runs[runs.length - 1];
    if (last && last[last.length - 1] === index - 1) {
      last.push(index);
    } else {
      runs.push([index]);
    }
  }
  return runs
    .map((run) => {
      const first = WEEKDAY_LABEL[WEEKDAY_ORDER[run[0] as number] as Weekday];
      const last = WEEKDAY_LABEL[WEEKDAY_ORDER[run[run.length - 1] as number] as Weekday];
      if (run.length >= 3) return `${first}–${last}`;
      return run.map((i) => WEEKDAY_LABEL[WEEKDAY_ORDER[i] as Weekday]).join(", ");
    })
    .join(", ");
}

/** "09:00" -> "9 AM", "21:00" -> "9 PM", "09:30" -> "9:30 AM", "12:00" -> "12 PM". */
function formatTime(time: string): string {
  const [hourText, minuteText] = time.split(":");
  const hour = Number(hourText);
  const minute = Number(minuteText);
  if (!Number.isInteger(hour) || !Number.isInteger(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    throw new RangeError(`formatTime expects "HH:MM", got "${time}"`);
  }
  const suffix = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  return minute === 0 ? `${displayHour} ${suffix}` : `${displayHour}:${String(minute).padStart(2, "0")} ${suffix}`;
}

function formatRuleTimes(rule: OpeningHoursRule): string {
  return `${formatTime(rule.opens)} – ${formatTime(rule.closes)}`;
}

/**
 * Days and times as separate strings, for layouts that show them apart.
 * The times string always ends with "PKT" (Karachi time).
 * Example: { days: "Mon–Sat", times: "9 AM – 9 PM PKT" }
 */
export function formatOpeningHoursParts(rules: OpeningHoursRule[]): { days: string; times: string } {
  return {
    days: rules.map((rule) => formatDays(rule.days)).join("; "),
    times: `${rules.map(formatRuleTimes).join("; ")} PKT`,
  };
}

/** "Mon–Sat, 9 AM – 9 PM PKT". Always ends with "PKT" (Karachi time). */
export function formatOpeningHours(rules: OpeningHoursRule[]): string {
  if (rules.length === 1) {
    const { days, times } = formatOpeningHoursParts(rules);
    return `${days}, ${times}`;
  }
  return `${rules.map((rule) => `${formatDays(rule.days)}, ${formatRuleTimes(rule)}`).join("; ")} PKT`;
}
