// What the Insights charts say, as pure functions: a round top for the scale, a short sentence for each chart
// (the text a screen reader gets instead of the picture) and the shade of a heat cell.
import { formatDayMonth } from "@/admin/lib/format";
import { STATUS_LABEL } from "@/admin/lib/statusRules";
import type { Insights } from "@/admin/lib/schemas";

export const MIN_BOOKINGS = 5;

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** The smallest "round" number at or above `max`: 1, 2, 5, 10, 20, 50 ... so the top gridline is a clean figure. */
export function niceMax(max: number): number {
  if (max <= 4) return Math.max(max, 1);
  const magnitude = 10 ** Math.floor(Math.log10(max));
  for (const step of [1, 2, 5, 10]) if (step * magnitude >= max) return step * magnitude;
  return 10 * magnitude;
}

/** `09` -> `09:00`. */
export const hourLabel = (hour: number) => `${String(hour).padStart(2, "0")}:00`;

export function perDaySummary(data: Insights): string {
  const days = data.perDay.length;
  if (data.total === 0) return `No bookings in the last ${days} days.`;
  const busiest = data.perDay.reduce((best, day) => (day.count > best.count ? day : best), data.perDay[0]!);
  const average = Math.round((data.total / days) * 10) / 10;
  const cancelled = data.byStatus.find((row) => row.status === "cancelled")?.count ?? 0;
  return `${plural(data.total, "booking")} in the last ${days} days, not counting ${cancelled} cancelled. ${average} a day on average; busiest day ${formatDayMonth(busiest.date)} with ${busiest.count}.`;
}

export function departmentSummary(data: Insights): string {
  const rows = data.byDepartment;
  if (rows.length === 0) return "No bookings by department.";
  const top = rows[0]!;
  const cancelled = rows.reduce((sum, row) => sum + row.cancelled, 0);
  return `${top.departmentName} has the most bookings, ${top.count} of ${data.total} (cancelled not counted). ${plural(cancelled, "booking")} cancelled across ${plural(rows.length, "department")}.`;
}

export function statusSummary(data: Insights): string {
  const all = data.byStatus.reduce((sum, row) => sum + row.count, 0);
  return `All ${plural(all, "booking")}, cancelled included: ${data.byStatus.map((row) => `${row.count} ${STATUS_LABEL[row.status].toLowerCase()}`).join(", ")}.`;
}

export function hourSummary(data: Insights): string {
  const busiest = data.byHour.reduce((best, hour) => (hour.count > best.count ? hour : best), data.byHour[0]!);
  if (busiest.count === 0) return "No bookings by hour.";
  return `Busiest hour ${hourLabel(busiest.hour)} to ${hourLabel((busiest.hour + 1) % 24)} with ${plural(busiest.count, "booking")}, clinic time.`;
}

/** 0 (none) to 4 (the busiest hour): five steps of one colour, so a cell is never told apart by hue alone. */
export function heatLevel(count: number, max: number): 0 | 1 | 2 | 3 | 4 {
  if (count <= 0 || max <= 0) return 0;
  return Math.min(4, Math.max(1, Math.ceil((count / max) * 4))) as 1 | 2 | 3 | 4;
}

/** The hours the strip draws: the clinic day (08:00 to 21:00) widened to any hour that has bookings. */
export function hourWindow(byHour: Insights["byHour"]): { from: number; to: number } {
  const busy = byHour.filter((hour) => hour.count > 0).map((hour) => hour.hour);
  return { from: Math.min(8, ...busy), to: Math.max(20, ...busy) };
}
