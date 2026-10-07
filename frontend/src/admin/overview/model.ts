// What the Overview works out from the API's answer, as pure functions: names and initials, trend
// phrases, the agenda's time window, and the numbers re-derived when the visitor changes a status or the
// demo adds a booking. The server remains the source of truth for a staff session; this keeps the screen
// right between two polls and lets the demo's browser-only changes show up in every card at once.
import { formatDayMonth } from "@/admin/lib/format";
import type { AgendaDoctor, BookingStatus, BookingSummary, Kpis, Overview, Trend } from "@/admin/lib/schemas";
import { allowedNext } from "@/admin/lib/statusRules";

export const NEXT_UP_LIMIT = 5;
/** A confirmed patient who is up to 15 minutes late is still listed (data-model §8). */
export const NEXT_UP_GRACE_MS = 15 * 60_000;
export const DEFAULT_DAY_START = 9 * 60;
export const DEFAULT_DAY_END = 20 * 60;

export const STATUS_ORDER: readonly BookingStatus[] = ["completed", "arrived", "confirmed", "no_show", "cancelled"];
export type Counts = Record<BookingStatus, number>;

/** `Khadija N.` -> `K.N.`: all the agenda shows and says of a patient. */
export function initialsOf(masked: string): string {
  const words = masked.split(/\s+/).filter(Boolean);
  if (words.length === 0) return "";
  const picked = words.length === 1 ? [words[0]] : [words[0], words[words.length - 1]];
  return picked.map((word) => `${(word ?? "").charAt(0).toUpperCase()}.`).join("");
}

/** `Dr. Ayesha Rahman` -> `Dr. Rahman`. */
export function shortDoctor(name: string): string {
  const words = name.split(/\s+/).filter(Boolean);
  if (words.length < 3) return name;
  return `${words[0]} ${words[words.length - 1]}`;
}

/** `11:40` -> 700 minutes after midnight. */
export function minutesOf(hhmm: string): number {
  const [h = "0", m = "0"] = hhmm.split(":");
  return Number(h) * 60 + Number(m);
}

export function formatMinutes(total: number): string {
  const clamped = Math.max(0, Math.min(24 * 60 - 1, Math.round(total)));
  return `${String(Math.floor(clamped / 60)).padStart(2, "0")}:${String(clamped % 60).padStart(2, "0")}`;
}

/** `2026-09-28` (a Monday) -> `last Mon`. */
export function lastWeekLabel(comparedTo: string): string {
  return `last ${formatDayMonth(comparedTo).split(" ")[0]}`;
}

export type TrendView = { direction: "up" | "down" | "flat"; tone: "good" | "bad" | "flat"; text: string; phrase: string; label: string };

/**
 * The chip beside a KPI: arrow and number, plus the sentence a screen reader gets ("down 4 on last Mon").
 * `tone` is the meaning of the change: for no-shows and cancellations (`lowerIsBetter`) a fall is good.
 */
export function trendView(trend: Trend, unit: "" | "pts" = "", lowerIsBetter = false): TrendView | null {
  if (trend.delta === null) return null;
  const label = lastWeekLabel(trend.comparedTo);
  const size = `${Math.abs(trend.delta)}${unit ? ` ${unit}` : ""}`;
  const direction = trend.delta > 0 ? "up" : trend.delta < 0 ? "down" : "flat";
  const tone = direction === "flat" ? "flat" : (direction === "down") === lowerIsBetter ? "good" : "bad";
  const phrase = direction === "flat" ? `same as ${label}` : `${direction} ${size} on ${label}`;
  return { direction, tone, text: size, phrase, label };
}

export function bookingLength(item: BookingSummary): number {
  return Math.max(1, Math.round((Date.parse(item.endsAt) - Date.parse(item.startsAt)) / 60_000));
}

/** The window the timeline draws: 09:00 to 20:00, wider only if a session or booking falls outside it. */
export function agendaWindow(agenda: readonly AgendaDoctor[]): { start: number; end: number } {
  let start = DEFAULT_DAY_START;
  let end = DEFAULT_DAY_END;
  for (const row of agenda) {
    for (const session of row.sessions) {
      start = Math.min(start, Math.floor(minutesOf(session.start) / 60) * 60);
      end = Math.max(end, Math.ceil(minutesOf(session.end) / 60) * 60);
    }
    for (const item of row.items) {
      const from = minutesOf(item.localTime);
      start = Math.min(start, Math.floor(from / 60) * 60);
      end = Math.max(end, Math.ceil((from + bookingLength(item)) / 60) * 60);
    }
  }
  return { start, end: Math.min(end, 24 * 60) };
}

/** Time inside the window that is outside every session: the timeline hatches it. */
export function offHours(sessions: AgendaDoctor["sessions"], window: { start: number; end: number }): { from: number; to: number }[] {
  const spans = sessions
    .map((s) => ({ from: Math.max(window.start, minutesOf(s.start)), to: Math.min(window.end, minutesOf(s.end)) }))
    .filter((s) => s.to > s.from)
    .sort((a, b) => a.from - b.from);
  const out: { from: number; to: number }[] = [];
  let cursor = window.start;
  for (const span of spans) {
    if (span.from > cursor) out.push({ from: cursor, to: span.from });
    cursor = Math.max(cursor, span.to);
  }
  if (cursor < window.end) out.push({ from: cursor, to: window.end });
  return out;
}

export function countStatuses(items: readonly { status: BookingStatus }[]): Counts {
  const counts: Counts = { confirmed: 0, arrived: 0, completed: 0, no_show: 0, cancelled: 0 };
  for (const item of items) counts[item.status] += 1;
  return counts;
}

/** Confirmed, starting no earlier than 15 minutes ago, soonest first, five at most (data-model §8). */
export function nextUpOf(items: readonly BookingSummary[], nowMs: number): BookingSummary[] {
  return items
    .filter((item) => item.status === "confirmed" && Date.parse(item.startsAt) >= nowMs - NEXT_UP_GRACE_MS)
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt) || a.doctor.name.localeCompare(b.doctor.name) || a.reference.localeCompare(b.reference))
    .slice(0, NEXT_UP_LIMIT);
}

/** The booking with the statuses it may move to right now (they change as the clock passes its start). */
export function refine(item: BookingSummary, nowMs: number): BookingSummary {
  const next = allowedNext(item.status, Date.parse(item.startsAt), nowMs);
  return next.length === item.allowedNext.length && next.every((to, i) => to === item.allowedNext[i]) ? item : { ...item, allowedNext: next };
}

/** Scheduled slots of the doctors on the agenda, in the length the bookings use (15 minutes if none). */
export function scheduledSlots(agenda: readonly AgendaDoctor[]): number {
  const length = agenda.flatMap((row) => row.items).map(bookingLength)[0] ?? 15;
  return agenda.reduce((sum, row) => sum + row.sessions.reduce((n, s) => n + Math.floor((minutesOf(s.end) - minutesOf(s.start)) / length), 0), 0);
}

const withValue = (trend: Trend, value: number | null): Trend => ({ ...trend, value, delta: value === null || trend.previous === null ? null : value - trend.previous });

export type DeriveOptions = {
  nowMs: number;
  /** A status the visitor set on top of the server's (the demo's overlay). */
  statusOf?: (reference: string, serverStatus: BookingStatus) => BookingStatus;
  /** Bookings that exist only in this browser (the demo's simulated ones). */
  extras?: readonly BookingSummary[];
};

/**
 * The Overview as it is now: statuses and allowed steps as of the clock, the visitor's own changes laid
 * over, and the counts, the status mix and next patients recomputed from the same bookings, so no card can
 * disagree with another. Chair utilisation is recomputed only when the booked count moved.
 */
export function deriveOverview(base: Overview, { nowMs, statusOf, extras = [] }: DeriveOptions): Overview {
  const agenda = base.agenda.map((row) => {
    const own = extras.filter((extra) => extra.doctor.id === row.doctor.id);
    const items = [...row.items, ...own]
      .map((item) => {
        const status = statusOf ? statusOf(item.reference, item.status) : item.status;
        return refine(status === item.status ? item : { ...item, status }, nowMs);
      })
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt) || a.reference.localeCompare(b.reference));
    return { ...row, items };
  });
  const all = agenda.flatMap((row) => row.items);
  const counts = countStatuses(all);
  const appointments = all.length - counts.cancelled;

  const baseKpis = base.kpis;
  const slots = scheduledSlots(agenda);
  const utilisation = appointments === baseKpis.appointments.value ? baseKpis.utilisationPct : withValue(baseKpis.utilisationPct, slots > 0 ? Math.floor((200 * appointments + slots) / (2 * slots)) : null);
  const kpis: Kpis = {
    appointments: withValue(baseKpis.appointments, appointments),
    arrived: withValue(baseKpis.arrived, counts.arrived + counts.completed),
    completed: withValue(baseKpis.completed, counts.completed),
    noShows: withValue(baseKpis.noShows, counts.no_show),
    cancellations: withValue(baseKpis.cancellations, counts.cancelled),
    utilisationPct: utilisation,
  };
  return { ...base, agenda, kpis, nextUp: nextUpOf(all, nowMs) };
}
