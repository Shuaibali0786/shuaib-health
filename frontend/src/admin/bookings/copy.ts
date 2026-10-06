// Calm, specific messages for the Bookings screen. The screens branch on the error code, never on message text.
import { AdminApiError } from "@/admin/lib/client";
import { BookingDetailSchema, type BookingDetail } from "@/admin/lib/schemas";

export function bookingMessage(error: unknown): string {
  if (!(error instanceof AdminApiError)) return "Something went wrong. Please try again.";
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
    case "network":
    case "timeout":
      return "We could not reach the service. Please try again.";
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
