"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";

import { formatTime } from "@/admin/lib/format";
import type { AgendaDoctor, BookingSummary } from "@/admin/lib/schemas";
import { STATUS_LABEL } from "@/admin/lib/statusRules";
import { StatusBadge, STATUS_ICON } from "@/admin/bookings/StatusBadge";

import { agendaWindow, bookingLength, formatMinutes, initialsOf, minutesOf, offHours } from "./model";

/** The label a screen reader hears for a chip: "11:40, patient K.N., Confirmed. Open booking." */
export function chipLabel(booking: BookingSummary): string {
  return `${booking.localTime}, patient ${initialsOf(booking.patientNameMasked)}, ${STATUS_LABEL[booking.status]}. Open booking.`;
}

/** Keeps the tooltip's centre where it fits: its edges stay inside the timeline. */
export function clampTipX(centre: number, tipWidth: number, trackWidth: number): number {
  const half = tipWidth / 2;
  if (trackWidth <= tipWidth) return trackWidth / 2;
  return Math.max(half, Math.min(trackWidth - half, centre));
}

const HIDE_DELAY_MS = 150;

type Tip = { reference: string; centre: number; top: number };

export type OpenBooking = (booking: BookingSummary, trigger: HTMLElement) => void;

/**
 * Today's agenda on a wide screen: a row per doctor on an hour grid, a button chip per booking, hatching
 * outside the doctor's sessions and a gold "Now" line that moves with the clinic clock. A chip's tooltip
 * (time, initials, status) shows on hover, focus and touch, stays while the pointer is on it and closes on
 * Escape (WCAG 1.4.13); activating a chip opens the booking.
 */
export function AgendaTimeline({ agenda, nowMs, timeZone, highlight, onOpen }: { agenda: readonly AgendaDoctor[]; nowMs: number; timeZone: string; highlight: ReadonlySet<string>; onOpen: OpenBooking }) {
  const range = agendaWindow(agenda);
  const span = range.end - range.start;
  const hours = Array.from({ length: Math.ceil(span / 60) }, (_, i) => range.start + i * 60);
  const pct = (minute: number) => ((minute - range.start) / span) * 100;

  const track = useRef<HTMLDivElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tipId = useId();
  const [tip, setTip] = useState<Tip | null>(null);

  const cancelHide = useCallback(() => {
    if (hideTimer.current !== null) clearTimeout(hideTimer.current);
    hideTimer.current = null;
  }, []);
  const hide = useCallback(
    (delay = 0) => {
      cancelHide();
      hideTimer.current = setTimeout(() => setTip(null), delay);
    },
    [cancelHide],
  );
  useEffect(() => cancelHide, [cancelHide]);

  const show = (chip: HTMLElement, reference: string) => {
    const frame = track.current;
    if (!frame) return;
    cancelHide();
    const c = chip.getBoundingClientRect();
    const t = frame.getBoundingClientRect();
    setTip({ reference, centre: c.left - t.left + c.width / 2, top: c.top - t.top - 8 });
  };

  // Clamp after the tooltip has its real width.
  useLayoutEffect(() => {
    const node = tipRef.current;
    const frame = track.current;
    if (!tip || !node || !frame) return;
    node.style.left = `${clampTipX(tip.centre, node.offsetWidth, frame.offsetWidth)}px`;
  }, [tip]);

  useEffect(() => {
    if (!tip) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setTip(null);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [tip]);

  const active = tip ? agenda.flatMap((row) => row.items).find((item) => item.reference === tip.reference) : undefined;

  const nowMinute = minutesOf(formatTime(nowMs, timeZone));
  const fraction = (nowMinute - range.start) / span;
  const nowVisible = fraction >= 0 && fraction <= 1;

  return (
    <div className="tl-wrap">
      <div className="tl" ref={track} data-testid="agenda-timeline">
        <div className="tl-hours" aria-hidden="true">
          {hours.map((minute) => (
            <span key={minute} style={{ width: `${(60 / span) * 100}%` }}>
              {formatMinutes(minute)}
            </span>
          ))}
        </div>
        <div>
          {agenda.map((row) => (
            <div key={row.doctor.id} className="tl-row" role="group" aria-label={`${row.doctor.name}, ${row.doctor.departmentName}`}>
              <div className="tl-doc">
                <b title={row.doctor.name}>{row.doctor.name}</b>
                <span>
                  {row.doctor.departmentName}
                  {row.sessions.length > 0 ? ` · ${row.sessions.map((s) => `${s.start}–${s.end}`).join(", ")}` : ""}
                </span>
              </div>
              <div className="tl-lane" style={{ backgroundSize: `${(60 / span) * 100}% 100%` }}>
                {offHours(row.sessions, range).map((gap) => (
                  <div key={gap.from} className="tl-off" aria-hidden="true" style={{ left: `${pct(gap.from)}%`, width: `${pct(gap.to) - pct(gap.from)}%` }} />
                ))}
                {row.items.map((item) => {
                  const Icon = STATUS_ICON[item.status];
                  return (
                    <button
                      key={item.reference}
                      type="button"
                      className={`tl-b st-${item.status} ${item.status}${highlight.has(item.reference) ? " is-new" : ""}`}
                      data-ref={item.reference}
                      data-status={item.status}
                      style={{ left: `calc(${pct(minutesOf(item.localTime))}% + 2px)`, width: `calc(${(bookingLength(item) / span) * 100}% - 4px)` }}
                      aria-label={chipLabel(item)}
                      aria-describedby={tip?.reference === item.reference ? tipId : undefined}
                      onClick={(event) => {
                        setTip(null);
                        onOpen(item, event.currentTarget);
                      }}
                      onMouseEnter={(event) => show(event.currentTarget, item.reference)}
                      onMouseLeave={() => hide(HIDE_DELAY_MS)}
                      onFocus={(event) => show(event.currentTarget, item.reference)}
                      onBlur={() => hide(0)}
                      onPointerDown={(event) => {
                        if (event.pointerType !== "mouse") show(event.currentTarget, item.reference);
                      }}
                    >
                      <Icon className="i i-sm" aria-hidden="true" />
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        <div
          className="tl-now"
          data-testid="now-marker"
          data-label={`Now ${formatMinutes(nowMinute)}`}
          aria-hidden="true"
          hidden={!nowVisible}
          style={{ left: `calc(var(--doc-w) + (100% - var(--doc-w)) * ${Math.max(0, Math.min(1, fraction))})` }}
        />
        {tip && active ? (
          <div ref={tipRef} id={tipId} role="tooltip" className="tl-tip" data-testid="agenda-tip" style={{ left: tip.centre, top: tip.top }} onMouseEnter={cancelHide} onMouseLeave={() => hide(0)}>
            <b className="num">{active.localTime}</b> <span>{initialsOf(active.patientNameMasked)}</span> <StatusBadge status={active.status} />
          </div>
        ) : null}
      </div>
    </div>
  );
}
