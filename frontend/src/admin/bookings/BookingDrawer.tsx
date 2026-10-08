"use client";

import { Clock, ShieldCheck } from "lucide-react";

import { clinicDate, formatDayMonth, formatTime } from "@/admin/lib/format";
import type { BookingDetail, BookingStatus, BookingSummary, HistoryItem } from "@/admin/lib/schemas";
import { STATUS_LABEL, timeHint } from "@/admin/lib/statusRules";
import { Drawer } from "@/admin/ui/Drawer";
import { Skeleton } from "@/admin/ui/States";

import { PhoneReveal } from "./PhoneReveal";
import { StatusActions } from "./StatusActions";
import { StatusBadge } from "./StatusBadge";

const FINAL: readonly BookingStatus[] = ["completed", "no_show", "cancelled"];

const money = (pkr: number) => `PKR ${pkr.toLocaleString("en-GB")}`;

function ageText(detail: BookingDetail): string | null {
  if (detail.patientAge === undefined) return null;
  const age = detail.patientAge < 1 ? "Under 1 year" : `${detail.patientAge} ${detail.patientAge === 1 ? "year" : "years"}`;
  return detail.bookedBy ? `${age} · booked by ${detail.bookedBy}` : age;
}

function HistoryList({ items, timeZone }: { items: HistoryItem[]; timeZone: string }) {
  return (
    <ol className="history">
      {items.map((item, index) => (
        <li key={`${item.at}-${index}`} className={`st-${item.toStatus}`}>
          <b>
            {STATUS_LABEL[item.toStatus]}
            {item.isUndo ? " (undone)" : ""}
          </b>
          <span>
            {formatDayMonth(clinicDate(item.at, timeZone))}, {formatTime(item.at, timeZone)} · {item.actor}
          </span>
        </li>
      ))}
    </ol>
  );
}

/**
 * The booking detail drawer (FR-022): the booking's details with the phone masked until revealed, its
 * status history, and a next-step footer that offers only what the rules allow now. `summary` is the row
 * that opened it (always there); `detail` arrives a moment later, so the body shows placeholders first.
 */
export function BookingDrawer({
  summary,
  detail,
  history,
  failed,
  message,
  demo,
  busy,
  nowMs,
  timeZone,
  onChoose,
  onClose,
}: {
  summary: BookingSummary | null;
  detail: BookingDetail | null;
  history: HistoryItem[];
  failed: boolean;
  message: string | null;
  demo: boolean;
  busy: boolean;
  nowMs: number;
  timeZone: string;
  onChoose: (to: BookingStatus) => void;
  onClose: () => void;
}) {
  const open = summary !== null;
  const startsAt = summary ? Date.parse(summary.startsAt) : 0;
  const hint = summary ? timeHint(summary.status, startsAt, nowMs, (ms) => formatTime(ms, timeZone)) : null;
  const hasNext = (summary?.allowedNext.length ?? 0) > 0;
  return (
    <Drawer
      open={open}
      onClose={onClose}
      eyebrow={summary ? <span className="eyebrow">Booking {summary.reference}</span> : null}
      title={detail?.patientName ?? summary?.patientNameMasked ?? ""}
      footer={
        summary ? (
          <div className="dr-foot">
            {hasNext ? (
              <>
                <div className="lbl">Next step</div>
                <StatusActions allowedNext={summary.allowedNext} onChoose={onChoose} disabled={busy} />
              </>
            ) : (
              <div className="lbl">{FINAL.includes(summary.status) ? "Final status. No further steps." : "No change is available right now."}</div>
            )}
            {hint ? (
              <div className="hint">
                <Clock className="i i-sm" aria-hidden="true" />
                {hint}
              </div>
            ) : null}
            <div className="hint">
              <ShieldCheck className="i i-sm" aria-hidden="true" />
              {demo ? "Demo: changes stay in this browser and are not saved." : "Every change and phone reveal is recorded in Activity."}
            </div>
          </div>
        ) : null
      }
    >
      {summary ? (
        <>
          <div className="dr-badges">
            <StatusBadge status={summary.status} />
            {summary.isSample ? <span className="sample">Sample patient</span> : null}
          </div>
          {message ? (
            <p role="alert" className="field-error">
              {message}
            </p>
          ) : null}
          {failed ? (
            <p role="alert" className="field-error">
              We could not load all the details. Close this and try again.
            </p>
          ) : null}
          <dl className="dl">
            <dt>When</dt>
            <dd>
              <b>
                {formatDayMonth(summary.localDate)} · {summary.localTime}–{formatTime(summary.endsAt, timeZone)}
              </b>
              <div className="muted sub-line">Clinic time (Karachi)</div>
            </dd>
            <dt>Doctor</dt>
            <dd>
              {summary.doctor.name}
              <div className="muted sub-line">{summary.doctor.departmentName}</div>
            </dd>
            {detail && ageText(detail) ? (
              <>
                <dt>Patient</dt>
                <dd>{ageText(detail)}</dd>
              </>
            ) : null}
            <dt>Phone</dt>
            <dd>
              <PhoneReveal key={summary.reference} reference={summary.reference} masked={summary.phoneMasked} />
            </dd>
            <dt>Email</dt>
            <dd>{detail ? (detail.emailMasked ?? "Not given") : <Skeleton width={140} />}</dd>
            <dt>Reason</dt>
            <dd>{detail ? (detail.reason ?? "Not given") : <Skeleton width={180} />}</dd>
            <dt>Fee</dt>
            <dd className="num">{detail ? money(detail.feePkr) : <Skeleton width={90} />}</dd>
            <dt>Booked</dt>
            <dd>{detail ? `${formatDayMonth(clinicDate(detail.bookedAt, timeZone))}, ${formatTime(detail.bookedAt, timeZone)} · website` : <Skeleton width={150} />}</dd>
          </dl>
          <div className="section-title">Status history</div>
          {detail ? <HistoryList items={history} timeZone={timeZone} /> : <Skeleton width="70%" height={40} />}
        </>
      ) : null}
    </Drawer>
  );
}
