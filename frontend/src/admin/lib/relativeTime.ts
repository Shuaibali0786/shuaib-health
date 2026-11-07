// "Booked 2 hours ago" for the bell and the Booked column (Feature 012). Pure; the clock is passed in.

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const plural = (count: number, unit: string) => `${count} ${unit}${count === 1 ? "" : "s"} ago`;

/** `just now`, `12 minutes ago`, `2 hours ago`, `3 days ago`; after two weeks a count of weeks. */
export function bookedAgo(bookedAt: string | number, nowMs: number): string {
  const age = Math.max(0, nowMs - (typeof bookedAt === "number" ? bookedAt : Date.parse(bookedAt)));
  if (age < MINUTE) return "just now";
  if (age < HOUR) return plural(Math.floor(age / MINUTE), "minute");
  if (age < DAY) return plural(Math.floor(age / HOUR), "hour");
  if (age < 14 * DAY) return plural(Math.floor(age / DAY), "day");
  return plural(Math.floor(age / (7 * DAY)), "week");
}

/** "Tomorrow · Tue 6 Oct" or just the short date, for a day heading in the Upcoming view. */
export function dayHeading(date: string, today: string, formatShort: (date: string) => string): string {
  const next = new Date(Date.parse(`${today}T12:00:00Z`) + DAY).toISOString().slice(0, 10);
  return date === next ? `Tomorrow · ${formatShort(date)}` : formatShort(date);
}
