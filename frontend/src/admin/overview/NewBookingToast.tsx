"use client";

import { CalendarPlus, X } from "lucide-react";
import { useSyncExternalStore } from "react";

import { formatDayMonth } from "@/admin/lib/format";
import type { BookingSummary } from "@/admin/lib/schemas";
import { newBookings, type NewBookingToast } from "@/admin/state/newBookings";

import { shortDoctor } from "./model";

function Toast({ toast, today, onView }: { toast: NewBookingToast; today: string; onView: (booking: BookingSummary) => void }) {
  const { booking } = toast;
  const when = booking.localDate === today ? "today" : formatDayMonth(booking.localDate);
  return (
    <div
      className={`nb-toast${toast.held ? " paused" : ""}`}
      data-testid="new-booking-toast"
      data-ref={booking.reference}
      onMouseEnter={() => newBookings.hold(toast.id, "hover")}
      onMouseLeave={() => newBookings.release(toast.id, "hover")}
      onFocus={() => newBookings.hold(toast.id, "focus")}
      onBlur={() => newBookings.release(toast.id, "focus")}
    >
      <span className="nb-ic" aria-hidden="true">
        <CalendarPlus className="i" />
      </span>
      <div className="nb-body">
        <div className="nb-eyebrow">New booking</div>
        <div>
          <b>{booking.patientNameMasked}</b> with {shortDoctor(booking.doctor.name)}
        </div>
        <div className="nb-sub">
          {booking.doctor.departmentName} · {when} {booking.localTime} · booked just now
        </div>
        <button
          type="button"
          className="btn btn-sm nb-view"
          onClick={() => {
            newBookings.dismiss(toast.id);
            onView(booking);
          }}
        >
          View booking
        </button>
      </div>
      <div className="nb-acts">
        <button type="button" className="nb-x" aria-label="Dismiss notification" onClick={() => newBookings.dismiss(toast.id)}>
          <X className="i i-sm" aria-hidden="true" />
        </button>
      </div>
      <span className="nb-progress" aria-hidden="true" />
    </div>
  );
}

/**
 * The "New booking" notifications (FR-042): a polite live region, up to three at a time, top right on a
 * desktop and under the top bar on a phone. "View booking" opens the booking through `onView`.
 */
export function NewBookingToasts({ today, onView }: { today: string; onView: (booking: BookingSummary) => void }) {
  useSyncExternalStore(newBookings.subscribe, newBookings.getSnapshot, () => 0);
  return (
    <div className="toasts" role="region" aria-label="Notifications" aria-live="polite" data-testid="toasts">
      {newBookings.toasts().map((toast) => (
        <Toast key={toast.id} toast={toast} today={today} onView={onView} />
      ))}
    </div>
  );
}
