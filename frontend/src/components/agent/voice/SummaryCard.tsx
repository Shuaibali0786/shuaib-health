"use client";

import { Check, Pencil } from "lucide-react";

import type { KnowledgePack } from "@/agent/types";
import { cn } from "@/lib/cn";
import type { BookingState } from "@/voice/bookingDialog";
import { groupPhone } from "@/voice/chunk";
import { speakDate, speakTime } from "@/voice/parse/date";

type Row = { label: string; value: string | null; corrected: boolean };

function rowsOf(state: BookingState, pack: KnowledgePack): Row[] {
  const d = state.draft;
  const doctor = pack.doctors.find((x) => x.slug === d.doctorSlug);
  const department = pack.departments.find((x) => x.slug === (doctor?.departmentSlug ?? d.departmentSlug));
  const when = d.date ? `${speakDate(d.date)}${d.time ? ` · ${speakTime(d.time)}` : ""}` : null;
  return [
    { label: "Name", value: d.fullName, corrected: d.corrected.includes("fullName") },
    { label: "Phone", value: d.phone ? groupPhone(d.phone) : d.phonePartial ? `${d.phonePartial}…` : null, corrected: d.corrected.includes("phone") },
    { label: "Reason", value: d.reason ?? (d.reasonAnswered ? "Not given" : null), corrected: false },
    { label: "Doctor", value: doctor ? `${doctor.name}${department ? `, ${department.name}` : ""}` : (department?.name ?? null), corrected: d.corrected.includes("doctorSlug") },
    { label: "When", value: when, corrected: d.corrected.includes("date") },
    { label: "Email", value: d.email ?? (d.emailAnswered ? "Not given" : null), corrected: d.corrected.includes("email") },
  ];
}

type Props = { state: BookingState; pack: KnowledgePack; onConfirm: () => void; onChange: () => void };

/**
 * The booking being collected, mirrored on screen inside the chat while the caller talks (FR-043). It shows what
 * was heard, marks corrections, and is read by screen readers as a list. "Yes, confirm" and "Change" mirror the
 * spoken yes: a tap is the caller's own action, so it counts exactly like saying yes after the read-back.
 */
export function SummaryCard({ state, pack, onConfirm, onChange }: Props) {
  const waiting = state.phase === "awaiting_yes";
  const rows = rowsOf(state, pack);
  if (rows.every((r) => r.value === null)) return null;
  return (
    <section aria-label="Your booking so far" data-testid="voice-summary" className="rounded-card border border-border-strong bg-white p-3.5 shadow-soft">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-bold text-navy-900">Your booking</h3>
        <span className={cn("rounded-pill px-2.5 py-0.5 text-xs font-semibold", waiting ? "bg-gold-50 text-gold-700" : "bg-teal-50 text-teal-700")}>{waiting ? "Waiting for your yes" : "Not booked yet"}</span>
      </div>
      <dl className="mt-2.5 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-sm">
        {rows.map((row) => (
          <div key={row.label} className="contents">
            <dt className="text-ink">{row.label}</dt>
            <dd className={cn("min-w-0 break-words", row.value ? "font-semibold text-navy-900" : "text-ink")}>
              {row.value ? (
                <>
                  {row.value}
                  {row.corrected ? <span className="ml-1.5 rounded-pill bg-surface px-1.5 py-0.5 text-xs font-semibold text-ink">updated</span> : null}
                </>
              ) : (
                <span className="text-ink">Still needed</span>
              )}
            </dd>
          </div>
        ))}
      </dl>
      {waiting ? (
        <div className="mt-3 flex gap-2">
          <button type="button" onClick={onConfirm} className="inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-control bg-navy-900 px-4 text-sm font-semibold text-white">
            <Check className="size-4" aria-hidden="true" />
            Yes, confirm
          </button>
          <button type="button" onClick={onChange} className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-control border border-border-strong bg-white px-4 text-sm font-semibold text-navy-900">
            <Pencil className="size-4" aria-hidden="true" />
            Change
          </button>
        </div>
      ) : null}
      {waiting ? <p className="mt-2 text-xs text-ink">Saying yes, or tapping Yes, confirm, means you accept the clinic&apos;s booking rules.</p> : null}
    </section>
  );
}
