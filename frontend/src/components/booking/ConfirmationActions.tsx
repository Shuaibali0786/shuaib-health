"use client";

import { CalendarPlus, Download, MessageCircle, Plus, Printer } from "lucide-react";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import type { AppointmentView } from "@/lib/booking/schemas";
import type { SlipClinic } from "@/lib/booking/slip";
import { whatsappLink } from "@/lib/booking/whatsapp";
import { ROUTES } from "@/lib/routes";

// The PDF, QR and calendar builders are only needed after a click, so they load on demand.
const loadSlip = () => import("@/lib/booking/slip");

const SECONDARY =
  "inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-control border-2 border-navy-900 bg-white px-4 py-2.5 text-base font-semibold text-navy-900 transition-colors duration-150 hover:bg-surface";

function saveBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** A phone or tablet, where the share sheet (Gallery, Files, WhatsApp) is more useful than a download. */
const prefersShareSheet = (): boolean => typeof window.matchMedia === "function" && window.matchMedia("(pointer: coarse)").matches;

type Outcome = "shared" | "downloaded" | "cancelled";

/** Shares the PDF as a file where the device allows it, otherwise downloads it. */
async function deliverPdf(bytes: Uint8Array<ArrayBuffer>, fileName: string, title: string): Promise<Outcome> {
  const file = new File([bytes], fileName, { type: "application/pdf" });
  if (prefersShareSheet() && typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title });
      return "shared";
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return "cancelled";
      // Any other failure: fall through to a normal download.
    }
  }
  saveBlob(file, fileName);
  return "downloaded";
}

function Action({ icon, children, ...rest }: { icon: ReactNode; children: ReactNode; onClick?: () => void; href?: string }) {
  const content = (
    <>
      {icon}
      {children}
    </>
  );
  if (rest.href !== undefined) {
    const external = rest.href.startsWith("http");
    return (
      <a href={rest.href} className={SECONDARY} {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
        {content}
      </a>
    );
  }
  return (
    <button type="button" onClick={rest.onClick} className={SECONDARY}>
      {content}
    </button>
  );
}

/**
 * The actions beside the masked confirmation card. Renders two blocks as direct children of the page
 * layout: the Download button (sticky at the bottom of the screen on mobile) and the secondary actions.
 * Everything is built from the masked view only, so no file or message can carry personal details.
 */
export function ConfirmationActions({ view, clinic }: { view: AppointmentView; clinic: SlipClinic }) {
  const [status, setStatus] = useState("");
  const [calendarNote, setCalendarNote] = useState("");
  const [busy, setBusy] = useState(false);

  async function download() {
    setBusy(true);
    setStatus("");
    try {
      const [{ buildSlipPdf, slipFileName }, { loadSlipFonts }] = await Promise.all([loadSlip(), import("@/lib/booking/slip-fonts")]);
      const fonts = await loadSlipFonts(); // the website's own fonts, embedded so the PDF looks like this page
      const outcome = await deliverPdf(buildSlipPdf(view, clinic, fonts), slipFileName(view), `Appointment ${view.reference}`);
      if (outcome === "downloaded") setStatus("Your slip was downloaded. Look in your Downloads or Files app.");
      else if (outcome === "shared") setStatus("Your slip is ready to save or send.");
    } catch {
      setStatus("We couldn't make the PDF. Please take a screenshot of this page instead.");
    } finally {
      setBusy(false);
    }
  }

  async function addToCalendar() {
    try {
      const { buildCalendarIcs } = await loadSlip();
      saveBlob(new Blob([buildCalendarIcs(view, clinic)], { type: "text/calendar;charset=utf-8" }), `appointment-${view.reference}.ics`);
      setCalendarNote("Calendar file saved. Open it to add the appointment to your calendar.");
    } catch {
      setCalendarNote("We couldn't make the calendar file. Please add the appointment by hand.");
    }
  }

  return (
    <>
      <div className="sticky bottom-3 z-20 rounded-card border border-border bg-white/95 p-3 shadow-soft backdrop-blur print:hidden lg:static lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none lg:backdrop-blur-none">
        <button
          type="button"
          onClick={download}
          disabled={busy}
          className="inline-flex min-h-14 w-full items-center justify-center gap-3 rounded-card bg-linear-to-br from-teal-700 to-navy-900 px-6 py-3 text-lg font-bold text-white shadow-soft transition-[filter] duration-150 hover:brightness-110 disabled:opacity-70"
        >
          <Download aria-hidden="true" className="size-6" />
          {busy ? "Preparing your slip…" : "Download your slip"}
        </button>
        <p role="status" className={status ? "mt-2 text-center text-sm text-muted" : "text-center text-sm"}>
          {status}
        </p>
      </div>

      <div className="grid gap-3 print:hidden" aria-label="More actions" role="group">
        <Action icon={<Printer aria-hidden="true" className="size-5" />} onClick={() => window.print()}>
          Print
        </Action>
        <Action icon={<MessageCircle aria-hidden="true" className="size-5" />} href={whatsappLink(view, clinic)}>
          Share on WhatsApp
        </Action>
        <div>
          <Action icon={<CalendarPlus aria-hidden="true" className="size-5" />} onClick={addToCalendar}>
            Add to calendar
          </Action>
          <p aria-live="polite" className={calendarNote ? "mt-2 text-center text-sm text-muted" : "text-center text-sm"}>
            {calendarNote}
          </p>
        </div>
        <Link href={ROUTES.bookAppointment} className={SECONDARY}>
          <Plus aria-hidden="true" className="size-5" />
          Book another appointment
        </Link>
      </div>
    </>
  );
}
