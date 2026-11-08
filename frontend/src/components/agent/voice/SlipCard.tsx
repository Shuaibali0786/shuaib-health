"use client";

import { Download } from "lucide-react";
import { useState } from "react";

import type { KnowledgePack } from "@/agent/types";
import { groupReference } from "@/voice/chunk";
import { arriveByTime, formatLocalDateWithYear } from "@/lib/booking/labels";
import { qrModules, qrPath } from "@/lib/booking/qr";
import type { AppointmentView } from "@/lib/booking/schemas";
import type { SlipClinic } from "@/lib/booking/slip";
import { formatPkr } from "@/lib/format";

const QUIET = 2;

// The PDF builders (and their fonts) load only after the button is pressed, as on the confirmation page.
const loadSlip = () => import("@/lib/booking/slip");

function clinicOf(pack: KnowledgePack): SlipClinic {
  return {
    name: pack.clinic.name,
    address: pack.clinic.address,
    phoneDisplay: pack.clinic.phone,
    phoneTel: pack.clinic.phone.replace(/[^\d+]/g, ""),
    emergencyDisplay: pack.clinic.emergencyPhone,
  };
}

/** The booking reference as a QR code (the same one the website slip shows), drawn as a single path. */
function Qr({ reference }: { reference: string }) {
  const modules = qrModules(reference);
  const size = modules.length + 2 * QUIET;
  return (
    <svg viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`QR code for booking reference ${reference}`} className="size-24 shrink-0 rounded-control border border-border bg-white" shapeRendering="crispEdges">
      <path d={qrPath(modules, QUIET)} className="fill-navy-900" />
    </svg>
  );
}

/** The slip shown in the chat after a voice booking: reference, QR code, Download PDF and the arrival reminder. */
export function SlipCard({ view, pack }: { view: AppointmentView; pack: KnowledgePack }) {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");

  async function download() {
    setBusy(true);
    setStatus("");
    try {
      const [{ buildSlipPdf, slipFileName }, { loadSlipFonts }] = await Promise.all([loadSlip(), import("@/lib/booking/slip-fonts")]);
      const fonts = await loadSlipFonts();
      const bytes = buildSlipPdf(view, clinicOf(pack), fonts);
      const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = slipFileName(view);
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      setStatus("Your slip was downloaded. Look in your Downloads or Files app.");
    } catch {
      setStatus("We couldn't make the PDF. Please take a screenshot of this card instead.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-label="Your appointment slip" data-testid="voice-slip" className="rounded-card border border-gold-500 bg-white p-3.5 shadow-soft">
      <p className="text-[0.7rem] font-bold tracking-[0.18em] text-gold-700 uppercase">Appointment confirmed</p>
      <div className="mt-2 flex gap-3">
        <Qr reference={view.reference} />
        <div className="min-w-0 text-sm text-ink">
          <p className="text-xs">Reference</p>
          <p data-testid="voice-reference" className="font-heading text-xl font-bold tracking-wider text-navy-900">
            {groupReference(view.reference)}
          </p>
          <p className="mt-1 font-semibold text-navy-900">{view.doctor.fullName}</p>
          <p>
            {formatLocalDateWithYear(view.localDate)}, {view.localTime}
          </p>
          <p>Fee {formatPkr(view.feePkr)} (sample price)</p>
        </div>
      </div>
      <p className="mt-2.5 rounded-control bg-surface px-3 py-2 text-sm text-ink">
        Please arrive 15 minutes early (by {arriveByTime(view.localTime)}) and bring your CNIC and any old reports.
      </p>
      <button type="button" onClick={() => void download()} disabled={busy} className="mt-2.5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-control bg-navy-900 px-4 text-sm font-semibold text-white disabled:opacity-70">
        <Download className="size-4" aria-hidden="true" />
        {busy ? "Preparing your slip…" : "Download PDF"}
      </button>
      <p role="status" className={status ? "mt-1.5 text-center text-xs text-ink" : "sr-only"}>
        {status}
      </p>
    </section>
  );
}
