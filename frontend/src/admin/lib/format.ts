// Clinic-time formatting. Every function formats in the clinic's time zone (Asia/Karachi) whatever
// the device's zone is, so a laptop set to another zone still shows the clinic's day. Instants are ISO
// strings or Dates; dates are `YYYY-MM-DD` strings that are not shifted by any zone.

export const CLINIC_TIME_ZONE = "Asia/Karachi";

const parts = (value: Date, options: Intl.DateTimeFormatOptions, timeZone = CLINIC_TIME_ZONE) =>
  Object.fromEntries(new Intl.DateTimeFormat("en-GB", { ...options, timeZone }).formatToParts(value).map((p) => [p.type, p.value]));

const asDate = (value: Date | string | number) => (value instanceof Date ? value : new Date(value));

/** `14:35` (24-hour) for a table or a card. */
export function formatTime(value: Date | string | number, timeZone = CLINIC_TIME_ZONE): string {
  const p = parts(asDate(value), { hour: "2-digit", minute: "2-digit", hourCycle: "h23" }, timeZone);
  return `${p.hour}:${p.minute}`;
}

/** `11:20:45 AM` for the live clock. */
export function formatClock(value: Date | string | number, timeZone = CLINIC_TIME_ZONE): string {
  const p = parts(asDate(value), { hour: "numeric", minute: "2-digit", second: "2-digit", hour12: true }, timeZone);
  return `${p.hour}:${p.minute}:${p.second} ${String(p.dayPeriod).toUpperCase()}`;
}

/** The clinic's calendar date for an instant, as `YYYY-MM-DD`. */
export function clinicDate(value: Date | string | number, timeZone = CLINIC_TIME_ZONE): string {
  const p = parts(asDate(value), { year: "numeric", month: "2-digit", day: "2-digit" }, timeZone);
  return `${p.year}-${p.month}-${p.day}`;
}

const noon = (date: string) => new Date(`${date}T12:00:00Z`);

/** `Mon 5 Oct` for a `YYYY-MM-DD` date. */
export function formatDayMonth(date: string): string {
  const p = parts(noon(date), { weekday: "short", day: "numeric", month: "short" }, "UTC");
  return `${p.weekday} ${p.day} ${p.month}`;
}

/** `Monday 5 October 2026` for headings and accessible labels. */
export function formatLongDate(date: string): string {
  const p = parts(noon(date), { weekday: "long", day: "numeric", month: "long", year: "numeric" }, "UTC");
  return `${p.weekday} ${p.day} ${p.month} ${p.year}`;
}

export type Greeting = "Good morning" | "Good afternoon" | "Good evening";

/** By the clinic hour: 05:00-11:59 morning, 12:00-16:59 afternoon, anything else evening. */
export function greeting(value: Date | string | number, timeZone = CLINIC_TIME_ZONE): Greeting {
  const hour = Number(parts(asDate(value), { hour: "2-digit", hourCycle: "h23" }, timeZone).hour);
  if (hour >= 5 && hour < 12) return "Good morning";
  if (hour >= 12 && hour < 17) return "Good afternoon";
  return "Good evening";
}

/** The instant (ms) the clinic's calendar `date` begins in `timeZone`, whatever the device's zone is. */
export function clinicMidnight(date: string, timeZone = CLINIC_TIME_ZONE): number {
  const guess = Date.parse(`${date}T00:00:00Z`);
  const p = parts(new Date(guess), { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }, timeZone);
  const asUtc = Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour), Number(p.minute), Number(p.second));
  return guess - (asUtc - guess);
}
