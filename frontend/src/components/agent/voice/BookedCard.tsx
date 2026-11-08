"use client";

import { ExternalLink } from "lucide-react";

import { formatLocalDateWithYear } from "@/lib/booking/labels";
import type { AppointmentView } from "@/lib/booking/schemas";
import { ROUTES } from "@/lib/routes";
import { groupReference } from "@/voice/chunk";
import { T } from "@/voice/phrases";
import type { VoiceLang } from "@/voice/types";

/**
 * The card shown in the chat after a booking: the reference and a link to the SAME appointment slip page the website
 * form opens (QR code, Download PDF, WhatsApp), in a new tab so the conversation stays open.
 */
export function BookedCard({ view, lang }: { view: AppointmentView; lang: VoiceLang }) {
  const href = `${ROUTES.bookAppointment}/confirmed/${encodeURIComponent(view.reference)}`;
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
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-control bg-navy-900 px-4 text-sm font-semibold text-white"
      >
        {T(lang, "View / Download slip", "Slip dekhein / download karein")}
        <ExternalLink className="size-4" aria-hidden="true" />
        <span className="sr-only">{T(lang, "(opens in a new tab)", "(naye tab mein khulega)")}</span>
      </a>
      <p className="mt-2 text-xs text-ink">
        {T(lang, "Tap the link, download your slip, and bring it with you to the clinic.", "Is link ko tap karein, slip download karein, aur clinic aate waqt saath laayein.")}
      </p>
    </section>
  );
}
