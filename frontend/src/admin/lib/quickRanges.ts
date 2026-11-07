// Quick date ranges for the Bookings filters (Feature 008, US1). Pure date arithmetic on the clinic's
// `YYYY-MM-DD` "today" that the server sends, never the device clock, so a phone in another time zone
// still gets Karachi's tomorrow.

export type QuickRangeId = "today" | "tomorrow" | "next7" | "last7";
export type QuickRange = { id: QuickRangeId; label: string; from: string; to: string };

const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;

/** `2026-12-29` + 6 = `2027-01-04`. Noon UTC keeps it away from any day boundary. */
export function addDays(iso: string, days: number): string {
  const match = ISO.exec(iso);
  if (!match) throw new RangeError(`Not a YYYY-MM-DD date: ${iso}`);
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function quickRanges(today: string): QuickRange[] {
  return [
    { id: "today", label: "Today", from: today, to: today },
    { id: "tomorrow", label: "Tomorrow", from: addDays(today, 1), to: addDays(today, 1) },
    { id: "next7", label: "Next 7 days", from: today, to: addDays(today, 6) },
    { id: "last7", label: "Last 7 days", from: addDays(today, -6), to: today },
  ];
}

/**
 * The chip that matches the current filters, or null. No dates at all means "today" (the list's default),
 * and a single date given only as `from` or `to` means that one day.
 */
export function activeRange(filters: { from: string | null; to: string | null }, today: string): QuickRangeId | null {
  const from = filters.from ?? filters.to ?? today;
  const to = filters.to ?? from;
  return quickRanges(today).find((range) => range.from === from && range.to === to)?.id ?? null;
}
