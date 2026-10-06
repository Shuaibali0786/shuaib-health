"use client";

import { Clock } from "lucide-react";
import { useEffect } from "react";

import { clinicDate, formatClock, formatDayMonth } from "@/admin/lib/format";
import { clinicClock, deviceReference, useClinicNow } from "@/admin/state/clinicClock";
import { formatUpdatedAgo } from "@/admin/state/livePoll";
import { useLiveStatus } from "@/admin/state/liveStatus";

/** "Asia/Karachi" -> "Karachi". */
function cityOf(timeZone: string): string {
  return (timeZone.split("/").pop() ?? timeZone).replaceAll("_", " ");
}

/**
 * The live line above every screen: the eyebrow with today date, the clinic clock with seconds, and
 * the Live pill with the time since the last refresh (FR-040, FR-041). The clock shows clinic time from
 * the server reading, so a device with the wrong time or zone still shows the clinic time.
 * `demoDate` fixes the date for the demo viewer, whose today is its dataset date.
 */
export function StatusBar({ serverNow, timeZone, demoDate }: { serverNow: string; timeZone: string; demoDate?: string }) {
  const serverMs = Date.parse(serverNow);
  // Declared before useClinicNow so the offset is known when its subscription starts the clock.
  useEffect(() => {
    clinicClock.seed(serverMs, deviceReference());
  }, [serverMs]);
  const now = useClinicNow(serverMs);
  const live = useLiveStatus();

  const age = live ? formatUpdatedAgo(now - live.lastSuccessAt) : "updated just now";
  const stale = live?.failing ?? false;
  const date = demoDate ?? clinicDate(now, timeZone);

  return (
    <div className="statusbar">
      <span className="eyebrow">Command Centre · {formatDayMonth(date)}</span>
      <div className="statusbar-right">
        <span className="clock">
          <Clock className="i i-sm" aria-hidden="true" />
          <time dateTime={new Date(now).toISOString()} aria-live="off" suppressHydrationWarning>
            {formatClock(now, timeZone)}
          </time>
          <span className="tz">· {cityOf(timeZone)}</span>
        </span>
        <span className="live-pill" data-state={stale ? "stale" : "live"}>
          <span className="live-dot" aria-hidden="true" />
          {stale ? "Retrying" : "Live"}
          <span className="sep" aria-hidden="true">
            ·
          </span>
          <span className="updated">
            <span className="upd-word">updated </span>
            {age.replace(/^updated /, "")}
          </span>
        </span>
      </div>
    </div>
  );
}
