"use client";

import { useSyncExternalStore } from "react";
import { formatDayLong, formatDayShort, formatTime, formatTimeRange } from "@/lib/format";
import { availableDays, nextAvailable, type NextAvailable as Next } from "@/lib/schedule";
import type { ScheduleSession } from "@/types/content";

function describe(next: Next | undefined): string | null {
  if (!next) return null;
  if (next.kind === "today") return `Today, ${formatTimeRange(next.start, next.end)} PKT`;
  if (next.kind === "tomorrow") return `Tomorrow, ${formatTime(next.start)} PKT`;
  return `${formatDayLong(next.day)}, ${formatTime(next.start)} PKT`;
}

/** Re-check once a minute so "Today" turns into the next day when the last session ends. */
function subscribe(onChange: () => void): () => void {
  const timer = setInterval(onChange, 60_000);
  return () => clearInterval(timer);
}

/**
 * "Next available" for a doctor, worked out in the browser in Asia/Karachi (the page itself is
 * built once, so "today" cannot be known at build time). The server HTML and the first render
 * show the weekdays from the schedule ("Available Mon, Wed, Fri"), which are never stale; after
 * hydration this switches to the next session.
 */
export function NextAvailable({ schedule, className }: { schedule: ScheduleSession[]; className?: string }) {
  const label = useSyncExternalStore(
    subscribe,
    () => describe(nextAvailable(schedule)),
    () => null,
  );
  const days = availableDays(schedule).map(formatDayShort).join(", ");
  return (
    <p className={className}>
      {label ? (
        <>
          <span className="text-muted">Next available:</span> <span className="font-semibold text-navy-900">{label}</span>
        </>
      ) : (
        <>
          <span className="text-muted">Available</span> <span className="font-semibold text-navy-900">{days}</span>
        </>
      )}
    </p>
  );
}
