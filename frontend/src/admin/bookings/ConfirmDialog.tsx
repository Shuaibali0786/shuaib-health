"use client";

import { AlertDialog } from "@/admin/ui/Dialog";
import type { BookingStatus, BookingSummary } from "@/admin/lib/schemas";

import { ACTION_LABEL } from "./StatusActions";

export type ChangeRequest = { booking: BookingSummary; to: Exclude<BookingStatus, "confirmed"> };

export function confirmTitle({ booking, to }: ChangeRequest): string {
  const who = booking.patientNameMasked;
  if (to === "arrived") return `Mark ${who} as arrived for ${booking.localTime}?`;
  if (to === "completed") return `Mark ${who} as completed?`;
  if (to === "no_show") return `Mark ${who} as a no-show?`;
  return `Cancel the booking for ${who} at ${booking.localTime}?`;
}

/** Every status change asks first (FR-025). The safe choice, "Not now", has the initial focus. */
export function ConfirmDialog({ request, busy, onConfirm, onCancel }: { request: ChangeRequest | null; busy: boolean; onConfirm: () => void; onCancel: () => void }) {
  return (
    <AlertDialog
      open={request !== null}
      onClose={onCancel}
      title={request ? confirmTitle(request) : ""}
      actions={
        <>
          <button type="button" className="btn" onClick={onCancel} data-initial-focus="">
            Not now
          </button>
          <button type="button" className={request?.to === "cancelled" ? "btn btn-danger" : "btn btn-primary"} onClick={onConfirm} disabled={busy}>
            {request ? ACTION_LABEL[request.to] : ""}
          </button>
        </>
      }
    >
      {request ? `${request.booking.doctor.name} · ${request.booking.doctor.departmentName}. You can undo this for 10 seconds.` : null}
    </AlertDialog>
  );
}
