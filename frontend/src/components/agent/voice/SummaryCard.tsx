"use client";

import { Check, Pencil } from "lucide-react";
import { useState } from "react";

import type { KnowledgePack } from "@/agent/types";
import { cn } from "@/lib/cn";
import { formatPkr } from "@/lib/format";
import type { BookingState } from "@/voice/bookingDialog";
import { groupPhone } from "@/voice/chunk";
import { labItem } from "@/voice/entities";
import { speakDate, speakTime } from "@/voice/parse/date";
import { T } from "@/voice/phrases";
import type { VoiceLang } from "@/voice/types";

type Row = { label: string; value: string | null; corrected: boolean };

function rowsOf(state: BookingState, pack: KnowledgePack, lang: VoiceLang): Row[] {
  const d = state.draft;
  const doctor = pack.doctors.find((x) => x.slug === d.doctorSlug);
  const department = pack.departments.find((x) => x.slug === (doctor?.departmentSlug ?? d.departmentSlug));
  const test = labItem(pack, d.labTestSlug);
  const when = d.date ? `${speakDate(d.date)}${d.time ? ` · ${speakTime(d.time)}` : ""}` : null;
  return [
    test ? { label: test.kind === "package" ? "Package" : T(lang, "Test", "Test"), value: `${test.name} - ${formatPkr(test.pricePkr)} (sample)`, corrected: false } : { label: T(lang, "Reason", "Wajah"), value: d.reason ?? (d.reasonAnswered ? T(lang, "Not given", "Nahi di") : null), corrected: false },
    { label: T(lang, "Doctor", "Doctor"), value: doctor ? `${doctor.name}${department ? `, ${department.name}` : ""}` : (department?.name ?? null), corrected: d.corrected.includes("doctorSlug") },
    { label: T(lang, "When", "Kab"), value: when, corrected: d.corrected.includes("date") || d.corrected.includes("time") },
    { label: T(lang, "Name", "Naam"), value: d.fullName, corrected: d.corrected.includes("fullName") },
    { label: T(lang, "Mobile", "Mobile"), value: d.phone ? groupPhone(d.phone) : d.phonePartial ? `${d.phonePartial}…` : null, corrected: d.corrected.includes("phone") },
    { label: T(lang, "Email", "Email"), value: d.email ?? (d.emailAnswered ? T(lang, "Not given", "Nahi di") : null), corrected: d.corrected.includes("email") },
    ...(test ? [] : doctor ? [{ label: T(lang, "Fee", "Fee"), value: `${formatPkr(doctor.feePkr)} (sample)`, corrected: false }] : []),
  ];
}

export type CorrectionField = "date" | "time" | "name" | "phone" | "email";

/** What is said to the assistant when a patient taps "Change" on one item (the same as saying it). */
export const CORRECTION_TEXT: Record<VoiceLang, Record<CorrectionField, string>> = {
  en: { date: "the date is wrong", time: "the time is wrong", name: "my name is wrong", phone: "my phone number is wrong", email: "my email is wrong" },
  roman: { date: "date ghalat hai", time: "waqt ghalat hai", name: "naam ghalat hai", phone: "number ghalat hai", email: "email ghalat hai" },
};

const FIELD_LABEL: Record<VoiceLang, Record<CorrectionField, string>> = {
  en: { date: "Date", time: "Time", name: "Name", phone: "Mobile", email: "Email" },
  roman: { date: "Date", time: "Waqt", name: "Naam", phone: "Mobile", email: "Email" },
};

type Props = { state: BookingState; pack: KnowledgePack; lang: VoiceLang; onConfirm: () => void; onCorrect: (field: CorrectionField) => void };

/**
 * The booking card in the chat (FR-043): every detail the patient gave, filled in as they speak. When everything is
 * collected it asks them to check it: "Confirm" books (a tap is the patient's own action, exactly like saying yes),
 * "Change" lets them pick ONE item to fix, which is asked again before the card is shown again.
 */
export function SummaryCard({ state, pack, lang, onConfirm, onCorrect }: Props) {
  const [changing, setChanging] = useState(false);
  const waiting = state.phase === "awaiting_yes";
  const rows = rowsOf(state, pack, lang);
  if (rows.every((r) => r.value === null)) return null;
  return (
    <section aria-label={T(lang, "Your booking so far", "Aap ki booking ab tak")} data-testid="voice-summary" className="rounded-card border border-border-strong bg-white p-3.5 shadow-soft">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-bold text-navy-900">{T(lang, "Your booking", "Aap ki booking")}</h3>
        <span className={cn("rounded-pill px-2.5 py-0.5 text-xs font-semibold", waiting ? "bg-gold-50 text-gold-700" : "bg-teal-50 text-teal-700")}>
          {waiting ? T(lang, "Please check", "Check karein") : T(lang, "Not booked yet", "Abhi book nahi hui")}
        </span>
      </div>
      <dl className="mt-2.5 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-sm">
        {rows.map((row) => (
          <div key={row.label} className="contents">
            <dt className="text-ink">{row.label}</dt>
            <dd className={cn("min-w-0 break-words", row.value ? "font-semibold text-navy-900" : "text-ink")}>
              {row.value ? (
                <>
                  {row.value}
                  {row.corrected ? <span className="ml-1.5 rounded-pill bg-surface px-1.5 py-0.5 text-xs font-semibold text-ink">{T(lang, "updated", "badal diya")}</span> : null}
                </>
              ) : (
                <span className="text-ink">{T(lang, "Still needed", "Abhi baqi hai")}</span>
              )}
            </dd>
          </div>
        ))}
      </dl>
      {waiting ? (
        <>
          <p className="mt-3 text-sm font-semibold text-navy-900">{T(lang, "Please check, then say yes or tap Confirm.", "Please check karein, phir haan kahein ya Confirm dabaiye.")}</p>
          <div className="mt-2 flex gap-2">
            <button type="button" onClick={onConfirm} className="inline-flex min-h-12 flex-1 items-center justify-center gap-1.5 rounded-control bg-navy-900 px-4 text-base font-semibold text-white">
              <Check className="size-5" aria-hidden="true" />
              {T(lang, "Confirm", "Confirm")}
            </button>
            <button type="button" onClick={() => setChanging((open) => !open)} aria-expanded={changing} className="inline-flex min-h-12 items-center justify-center gap-1.5 rounded-control border border-border-strong bg-white px-4 text-base font-semibold text-navy-900">
              <Pencil className="size-4" aria-hidden="true" />
              {T(lang, "Change", "Change")}
            </button>
          </div>
          {changing ? (
            <div role="group" aria-label={T(lang, "What would you like to change?", "Kya badalna chahte hain?")} className="mt-2 flex flex-wrap gap-2">
              {(Object.keys(FIELD_LABEL[lang]) as CorrectionField[]).map((field) => (
                <button
                  key={field}
                  type="button"
                  onClick={() => {
                    setChanging(false);
                    onCorrect(field);
                  }}
                  className="min-h-11 rounded-pill border border-border-strong bg-white px-3.5 text-sm font-semibold text-navy-900 hover:bg-surface"
                >
                  {FIELD_LABEL[lang][field]}
                </button>
              ))}
            </div>
          ) : null}
          <p className="mt-2 text-xs text-ink">{T(lang, "Confirming means you accept the clinic's booking rules.", "Confirm karne ka matlab hai ke aap clinic ke booking rules maante hain.")}</p>
        </>
      ) : null}
    </section>
  );
}
