import { ChevronRight } from "lucide-react";

import { formatTime } from "@/admin/lib/format";
import type { BookingSummary } from "@/admin/lib/schemas";

import { StatusBadge } from "./StatusBadge";

/** The phone list: the whole card is one button that opens the drawer. */
export function BookingCards({ bookings, onOpen, timeZone }: { bookings: BookingSummary[]; onOpen: (booking: BookingSummary, opener: HTMLElement) => void; timeZone: string }) {
  return (
    <ul className="bcards">
      {bookings.map((booking) => (
        <li key={booking.reference}>
          <button type="button" className="bcard" data-ref={booking.reference} onClick={(event) => onOpen(booking, event.currentTarget)} aria-label={`${booking.patientNameMasked}, ${booking.localTime}, ${booking.doctor.name}, ${booking.status.replace("_", " ")}. Open details`}>
            <span className="t" aria-hidden="true">
              {booking.localTime}
              <small>{formatTime(booking.endsAt, timeZone)}</small>
            </span>
            <b aria-hidden="true">{booking.patientNameMasked}</b>
            <span className="sub" aria-hidden="true">
              {booking.doctor.name} · {booking.doctor.departmentName}
            </span>
            <span className="status-slot" aria-hidden="true">
              <StatusBadge status={booking.status} />
            </span>
            <span className="go" aria-hidden="true">
              <ChevronRight className="i i-sm" />
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
