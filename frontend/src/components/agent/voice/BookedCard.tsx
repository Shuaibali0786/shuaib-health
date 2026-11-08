"use client";

import { ExternalLink } from "lucide-react";

import { formatLocalDateWithYear } from "@/lib/booking/labels";
import type { AppointmentView } from "@/lib/booking/schemas";
import { formatPkr } from "@/lib/format";
import { ROUTES } from "@/lib/routes";
import { groupReference } from "@/voice/chunk";
import { T } from "@/voice/phrases";
import type { VoiceLang } from "@/voice/types";

/**
 * The card shown in the chat after a booking: the reference, and a big button that opens the SAME appointment slip the
 * website form creates (QR code, Download PDF, WhatsApp), in a new tab so the conversation stays open. For a lab test
 * the card and the slip show the test and its price (the booking itself is with the Pathology Lab doctor).
 */
export function BookedCard({ view, lang, test }: { view: AppointmentView; lang: VoiceLang; test?: { slug: string; name: string; pricePkr: number; kind?: "test" | "package" } }) {
  const base = `${ROUTES.bookAppointment}/confirmed/${encodeURIComponent(view.reference)}`;
  const href = test ? `${base}?test=${encodeURIComponent(test.slug)}` : base;
  return (
    <section aria-label={T(lang, "Your booking is confirmed", "Aap ki booking confirm ho gayi")} data-testid="voice-slip" className="rounded-card border border-gold-500 bg-white p-3.5 shadow-soft">
      <p className="text-[0.7rem] font-bold tracking-[0.18em] text-gold-700 uppercase">{T(lang, "Appointment confirmed", "Appointment confirm")}</p>
      <p className="mt-1.5 text-xs text-ink">{T(lang, "Reference", "Reference")}</p>
      <p data-testid="voice-reference" className="font-heading text-xl font-bold tracking-wider text-navy-900">
        {groupReference(view.reference)}
      </p>
      <p className="mt-1 text-sm text-ink">
        <span className="font-semibold text-navy-900">{view.doctor.fullName}</span> · {formatLocalDateWithYear(view.localDate)}, {view.localTime}
      </p>
      {test ? (
        <p className="text-sm text-ink" data-testid="voice-booked-test">
          {test.kind === "package" ? "Package" : "Test"}: <span className="font-semibold text-navy-900">{test.name}</span> - {formatPkr(test.pricePkr)} (sample)
        </p>
      ) : null}
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-3 inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-card bg-linear-to-br from-teal-700 to-navy-900 px-4 text-lg font-bold text-white shadow-soft"
      >
        Open my slip
        <ExternalLink className="size-5" aria-hidden="true" />
        <span className="sr-only">{T(lang, "(opens in a new tab)", "(naye tab mein khulega)")}</span>
      </a>
      <p className="mt-2 text-xs text-ink">
        {T(lang, "Download the slip, save it on your phone, and bring it with you to the clinic.", "Slip download karke mobile mein save karein aur clinic aate waqt saath laayein.")}
      </p>
    </section>
  );
}
