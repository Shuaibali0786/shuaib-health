// The booking status lifecycle (FR-023, FR-024), the same rules as backend/app/command_centre/status.py.
// The server decides for real bookings (`allowedNext`); this copy serves the demo, whose changes are only
// kept in the browser, and the labels. A test compares it with the mock API's copy over a grid of times.
import type { BookingStatus } from "./schemas";

export const STATUS_LABEL: Record<BookingStatus, string> = {
  confirmed: "Confirmed",
  arrived: "Arrived",
  completed: "Completed",
  no_show: "No-show",
  cancelled: "Cancelled",
};

const TRANSITIONS: Record<BookingStatus, readonly BookingStatus[]> = {
  confirmed: ["arrived", "no_show", "cancelled"],
  arrived: ["completed", "no_show"],
  completed: [],
  no_show: [],
  cancelled: [],
};
const DISPLAY_ORDER: readonly BookingStatus[] = ["arrived", "completed", "no_show", "cancelled"];
export const ARRIVE_LEAD_MS = 2 * 60 * 60 * 1000;

function timeRuleMet(to: BookingStatus, startsAtMs: number, nowMs: number): boolean {
  if (to === "arrived") return nowMs >= startsAtMs - ARRIVE_LEAD_MS;
  if (to === "no_show") return nowMs >= startsAtMs;
  if (to === "cancelled") return nowMs < startsAtMs;
  return true;
}

export function allowedNext(current: BookingStatus, startsAtMs: number, nowMs: number): BookingStatus[] {
  return DISPLAY_ORDER.filter((to) => TRANSITIONS[current].includes(to) && timeRuleMet(to, startsAtMs, nowMs));
}

/** The calm sentence under the next-step buttons: what is not available yet, and when it becomes so. */
export function timeHint(status: BookingStatus, startsAtMs: number, nowMs: number, formatTime: (ms: number) => string): string | null {
  if (status !== "confirmed") return null;
  if (nowMs < startsAtMs - ARRIVE_LEAD_MS) return `Arrived can be marked from ${formatTime(startsAtMs - ARRIVE_LEAD_MS)}. No-show becomes available at ${formatTime(startsAtMs)}.`;
  if (nowMs < startsAtMs) return `No-show becomes available at ${formatTime(startsAtMs)}.`;
  return null;
}
