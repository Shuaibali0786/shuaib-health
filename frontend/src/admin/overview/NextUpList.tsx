"use client";

import { LogIn } from "lucide-react";

import { formatTime } from "@/admin/lib/format";
import type { BookingSummary } from "@/admin/lib/schemas";
import { ARRIVE_LEAD_MS } from "@/admin/lib/statusRules";

import { shortDoctor } from "./model";

/**
 * The next patients up: confirmed, not yet arrived. "Mark arrived" goes through the same confirmation and
 * ten-second undo as everywhere else (`onArrive` only asks; the screen confirms). A patient more than two
 * hours away cannot be marked yet, and the row says when that opens.
 */
export function NextUpList({ items, timeZone, busyReference, onArrive }: { items: readonly BookingSummary[]; timeZone: string; busyReference: string | null; onArrive: (booking: BookingSummary) => void }) {
  if (items.length === 0) return <p className="empty">No more confirmed patients today.</p>;
  return (
    <ul className="next" data-testid="next-up">
      {items.map((item) => (
        <li key={item.reference} data-ref={item.reference}>
          <span className="time">{item.localTime}</span>
          <div className="who2">
            <b>{item.patientNameMasked}</b>
            <span>
              {shortDoctor(item.doctor.name)} · {item.doctor.departmentName}
            </span>
          </div>
          {item.allowedNext.includes("arrived") ? (
            <button type="button" className="btn btn-sm" disabled={busyReference === item.reference} onClick={() => onArrive(item)} aria-label={`Mark ${item.patientNameMasked} as arrived`}>
              <LogIn className="i i-sm" aria-hidden="true" />
              Mark arrived
            </button>
          ) : (
            <span className="muted next-wait">Arrival opens {formatTime(Date.parse(item.startsAt) - ARRIVE_LEAD_MS, timeZone)}</span>
          )}
        </li>
      ))}
    </ul>
  );
}
