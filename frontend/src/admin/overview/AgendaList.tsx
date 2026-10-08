"use client";

import { ChevronDown } from "lucide-react";
import { useState } from "react";

import { formatTime } from "@/admin/lib/format";
import type { AgendaDoctor, BookingSummary } from "@/admin/lib/schemas";
import { StatusBadge } from "@/admin/bookings/StatusBadge";

import type { OpenBooking } from "./AgendaTimeline";
import { formatMinutes, minutesOf } from "./model";

/**
 * Today's agenda on a phone: one collapsible panel per doctor with a row (a button) per booking and a
 * "Now 11:20" line before the first booking still to come. Which panels are open is kept here, so a
 * refresh of the data does not close what the visitor opened.
 */
export function AgendaList({ agenda, nowMs, timeZone, highlight, onOpen }: { agenda: readonly AgendaDoctor[]; nowMs: number; timeZone: string; highlight: ReadonlySet<string>; onOpen: OpenBooking }) {
  const nowMinute = minutesOf(formatTime(nowMs, timeZone));
  // Start with the doctor who has the next patient (or the first doctor) open.
  const [open, setOpen] = useState<ReadonlySet<string>>(() => {
    const upcoming = agenda.find((row) => row.items.some((item) => item.status === "confirmed" && Date.parse(item.startsAt) >= nowMs));
    const first = upcoming ?? agenda[0];
    return new Set(first ? [first.doctor.id] : []);
  });

  const toggle = (id: string, isOpen: boolean) =>
    setOpen((current) => {
      if (current.has(id) === isOpen) return current;
      const next = new Set(current);
      if (isOpen) next.add(id);
      else next.delete(id);
      return next;
    });

  return (
    <div className="m-agenda" data-testid="agenda-list">
      {agenda.map((row) => {
        const toSee = row.items.filter((item) => item.status === "confirmed" || item.status === "arrived").length;
        const marker = row.items.find((item: BookingSummary) => minutesOf(item.localTime) > nowMinute);
        return (
          <details key={row.doctor.id} className="m-doc" data-doc={row.doctor.id} open={open.has(row.doctor.id)} onToggle={(event) => toggle(row.doctor.id, event.currentTarget.open)}>
            <summary>
              <div>
                <b>{row.doctor.name}</b>
                <span>
                  {row.doctor.departmentName}
                  {row.sessions.length > 0 ? ` · ${row.sessions.map((s) => `${s.start}–${s.end}`).join(", ")}` : ""}
                </span>
              </div>
              <span className="count">
                {row.items.length} booked
                <br />
                {toSee} to see
              </span>
              <ChevronDown className="i i-sm" aria-hidden="true" />
            </summary>
            <ol>
              {row.items.map((item) => (
                <ListRow key={item.reference} item={item} showNow={item === marker} nowMinute={nowMinute} isNew={highlight.has(item.reference)} onOpen={onOpen} />
              ))}
            </ol>
          </details>
        );
      })}
    </div>
  );
}

function ListRow({ item, showNow, nowMinute, isNew, onOpen }: { item: BookingSummary; showNow: boolean; nowMinute: number; isNew: boolean; onOpen: OpenBooking }) {
  return (
    <>
      {showNow ? (
        <li className="m-now" data-testid="now-row">
          Now {formatMinutes(nowMinute)}
        </li>
      ) : null}
      <li>
        <button type="button" className={`m-row${isNew ? " is-new" : ""}`} data-ref={item.reference} onClick={(event) => onOpen(item, event.currentTarget)}>
          <span className="tm num">{item.localTime}</span>
          <span>{item.patientNameMasked}</span>
          <StatusBadge status={item.status} />
        </button>
      </li>
    </>
  );
}
