"use client";

import { useState } from "react";

import { AdminApiError, adminRequest } from "@/admin/lib/client";
import { BookingDetailSchema, StatusChangeResultSchema, type BookingDetail, type BookingStatus, type BookingSummary } from "@/admin/lib/schemas";
import { bookingMessage, latestFrom, messageFor, outcomeUnknown } from "@/admin/bookings/copy";
import type { ChangeRequest } from "@/admin/bookings/ConfirmDialog";
import { demoOverlay } from "@/admin/state/demoOverlay";
import { undoStore } from "@/admin/state/undo";

/**
 * Changing a booking's status from the Overview (a chip's drawer, or "Mark arrived" in Next patients up):
 * ask first (`request`), then change (`confirm`) and offer a ten-second undo, exactly as the Bookings
 * screen does (FR-025). A staff session changes the booking on the server; the demo keeps the change in
 * the browser (ADR-0009). `onApplied` receives the booking as it is now, so the screen can show it.
 */
export function useStatusFlow({ demo, onApplied, onStale }: { demo: boolean; onApplied: (booking: BookingDetail, before?: BookingStatus) => void; onStale: () => void }) {
  const [request, setRequest] = useState<ChangeRequest | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const choose = (booking: BookingSummary, to: BookingStatus) => {
    if (to !== "confirmed") setRequest({ booking, to });
  };

  async function undoOnServer(reference: string, changeId: string, before: BookingStatus) {
    try {
      onApplied(await adminRequest({ method: "POST", path: `bookings/${reference}/status/undo`, body: { changeId } }, BookingDetailSchema), before);
      setMessage(null);
    } catch (error) {
      setMessage(bookingMessage(error));
      const latest = latestFrom(error);
      if (latest) onApplied(latest);
      else if (outcomeUnknown(error)) onStale();
    }
  }

  async function confirm() {
    if (!request) return;
    const { booking, to } = request;
    setBusy(true);
    setMessage(null);
    try {
      if (demo) {
        demoOverlay.setStatus(booking.reference, booking.status, to);
        undoStore.offerUndo({ reference: booking.reference, message: messageFor(request), run: () => void demoOverlay.undo(booking.reference) });
      } else {
        const result = await adminRequest({ method: "POST", path: `bookings/${booking.reference}/status`, body: { to, expectedVersion: booking.version } }, StatusChangeResultSchema);
        onApplied(result.booking, booking.status);
        undoStore.offerUndo({ reference: booking.reference, message: messageFor(request), run: () => undoOnServer(booking.reference, result.changeId, to) });
      }
    } catch (error) {
      setMessage(bookingMessage(error));
      const latest = latestFrom(error);
      if (latest) onApplied(latest);
      else if ((error instanceof AdminApiError && error.status === 409) || outcomeUnknown(error)) onStale(); // never retried
    } finally {
      setBusy(false);
      setRequest(null);
    }
  }

  return { request, busy, message, setMessage, choose, confirm, cancel: () => setRequest(null) };
}
