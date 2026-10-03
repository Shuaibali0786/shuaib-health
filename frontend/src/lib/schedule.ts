import type { ScheduleSession, Weekday } from "@/types/content";

/**
 * Weekly-schedule helpers. All times are Asia/Karachi, which has no daylight saving,
 * so day arithmetic is exact. `nextAvailable` takes `now` so tests can fix the clock.
 */

const ORDER: Weekday[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

const toMinutes = (time: string): number => {
  const [hour, minute] = time.split(":").map(Number);
  return (hour ?? 0) * 60 + (minute ?? 0);
};

/** The weekdays a doctor sits, Monday first, without duplicates. */
export function availableDays(schedule: ScheduleSession[]): Weekday[] {
  const days = new Set<Weekday>(schedule.map((session) => session.day));
  return ORDER.filter((day) => days.has(day));
}

/** Sessions grouped by weekday (Monday first), each day's sessions sorted by start time. */
export function groupScheduleByDay(schedule: ScheduleSession[]): Array<{ day: Weekday; sessions: ScheduleSession[] }> {
  return availableDays(schedule).map((day) => ({
    day,
    sessions: schedule.filter((session) => session.day === day).sort((a, b) => toMinutes(a.start) - toMinutes(b.start)),
  }));
}

export type NextAvailable =
  | { kind: "today"; day: Weekday; start: string; end: string }
  | { kind: "tomorrow"; day: Weekday; start: string }
  | { kind: "later"; day: Weekday; start: string };

/** Today's weekday and minutes since midnight in Asia/Karachi. */
function karachiNow(now: Date): { day: Weekday; minutes: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Karachi",
    weekday: "short",
    hour: "numeric",
    minute: "numeric",
    hourCycle: "h23",
  }).formatToParts(now);
  const weekday = parts.find((part) => part.type === "weekday")?.value.toLowerCase().slice(0, 3);
  const hour = Number(parts.find((part) => part.type === "hour")?.value);
  const minute = Number(parts.find((part) => part.type === "minute")?.value);
  const day = ORDER.find((candidate) => candidate === weekday) ?? "mon";
  return { day, minutes: (hour % 24) * 60 + minute };
}

/**
 * The next time a doctor sits, in Asia/Karachi. A session that has not ended yet today counts
 * as "today"; otherwise the next weekday with a session ("tomorrow" if it is the day after).
 * Returns undefined only for an empty schedule.
 */
export function nextAvailable(schedule: ScheduleSession[], now: Date = new Date()): NextAvailable | undefined {
  if (schedule.length === 0) return undefined;
  const { day: today, minutes } = karachiNow(now);
  const todayIndex = ORDER.indexOf(today);

  const laterToday = schedule
    .filter((session) => session.day === today && toMinutes(session.end) > minutes)
    .sort((a, b) => toMinutes(a.start) - toMinutes(b.start))[0];
  if (laterToday) return { kind: "today", day: today, start: laterToday.start, end: laterToday.end };

  for (let offset = 1; offset <= 7; offset += 1) {
    const day = ORDER[(todayIndex + offset) % 7] as Weekday;
    const first = schedule
      .filter((session) => session.day === day)
      .sort((a, b) => toMinutes(a.start) - toMinutes(b.start))[0];
    if (first) return { kind: offset === 1 ? "tomorrow" : "later", day, start: first.start };
  }
  return undefined;
}
