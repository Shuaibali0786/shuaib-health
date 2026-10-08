// Calm, specific messages for the Bookings screen. The screens branch on the error code, never on message text.
import { AdminApiError } from "@/admin/lib/client";
import { BookingDetailSchema, type BookingDetail, type BookingSummary } from "@/admin/lib/schemas";
import { STATUS_LABEL } from "@/admin/lib/statusRules";

import type { ChangeRequest } from "./ConfirmDialog";

/**
 * A write whose outcome is unknown: no answer, a timeout or a server error. It may have been applied, so
 * the screen re-reads the booking instead of retrying (a second change could be applied twice).
 */
export function outcomeUnknown(error: unknown): boolean {
  return error instanceof AdminApiError && (error.status === 0 || error.status >= 500);
}

export function bookingMessage(error: unknown): string {
  if (!(error instanceof AdminApiError)) return "Something went wrong. Please try again.";
  if (outcomeUnknown(error)) return "We could not reach the service, so the change may not have been saved. The latest status has been loaded; check it before trying again.";
  switch (error.code) {
    case "booking_changed":
      return "This booking was changed by someone else. It has been refreshed.";
    case "undo_unavailable":
      return "This change can no longer be undone.";
    case "slot_taken":
      return "That time slot has been taken, so the booking cannot be restored.";
    case "transition_not_allowed":
      return "That change is not allowed right now.";
    case "demo_read_only":
      return "The demo is read-only.";
    case "forbidden":
      return "You do not have access to this.";
    default:
      return "Something went wrong. Please try again.";
  }
}

/** The booking as it is now, carried by a 409 (`latest`), so the screen can refresh without a request. */
export function latestFrom(error: unknown): BookingDetail | null {
  if (!(error instanceof AdminApiError) || error.status !== 409) return null;
  const body = error.body as { latest?: unknown } | null;
  const parsed = BookingDetailSchema.safeParse(body?.latest);
  return parsed.success ? parsed.data : null;
}

/** The list row of a booking the server returned in full. */
export const summaryOf = (detail: BookingDetail): BookingSummary => ({
  reference: detail.reference,
  startsAt: detail.startsAt,
  endsAt: detail.endsAt,
  localDate: detail.localDate,
  localTime: detail.localTime,
  status: detail.status,
  version: detail.version,
  patientNameMasked: detail.patientNameMasked,
  phoneMasked: detail.phoneMasked,
  doctor: detail.doctor,
  allowedNext: detail.allowedNext,
  isSample: detail.isSample,
});

/** The sentence of the undo offer: "Marked Ayesha K. as arrived." */
export const messageFor = (request: ChangeRequest): string => {
  const who = request.booking.patientNameMasked;
  if (request.to === "no_show") return `Marked ${who} as a no-show.`;
  if (request.to === "cancelled") return `Cancelled the booking for ${who}.`;
  return `Marked ${who} as ${STATUS_LABEL[request.to].toLowerCase()}.`;
};
