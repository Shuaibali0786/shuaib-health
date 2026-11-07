import { ChevronRight } from "lucide-react";

import { formatDayMonth, formatTime } from "@/admin/lib/format";
import { bookedAgo } from "@/admin/lib/relativeTime";
import type { BookingSummary } from "@/admin/lib/schemas";

import type { BookingListOptions } from "./BookingTable";
import { NewBadge } from "./NewBadge";
import { StatusBadge } from "./StatusBadge";

/** The phone list: the whole card is one button that opens the drawer. */
export function BookingCards({
  bookings,
  onOpen,
  timeZone,
  nowMs,
  isNew,
  showDate,
  groupOf,
}: { bookings: BookingSummary[]; onOpen: (booking: BookingSummary, opener: HTMLElement) => void } & BookingListOptions) {
  return (
    <ul className="bcards">
      {bookings.map((booking, index) => {
        const fresh = isNew(booking);
        const heading = groupOf && bookings[index - 1]?.localDate !== booking.localDate ? groupOf(booking.localDate) : null;
        return [
          heading ? (
            <li key={`day-${booking.localDate}`} className="day-head">
              <h3>
                {heading.label}
                <span className="day-count">
                  {heading.count} {heading.count === 1 ? "booking" : "bookings"}
                </span>
              </h3>
            </li>
          ) : null,
          <li key={booking.reference}>
            <button
              type="button"
              className="bcard"
              data-ref={booking.reference}
              data-new={fresh ? "true" : undefined}
              onClick={(event) => onOpen(booking, event.currentTarget)}
              aria-label={`${fresh ? "New booking. " : ""}${booking.patientNameMasked}, ${showDate ? `${formatDayMonth(booking.localDate)}, ` : ""}${booking.localTime}, ${booking.doctor.name}, ${booking.status.replace("_", " ")}. Booked ${bookedAgo(booking.bookedAt, nowMs)}. Open details`}
            >
              <span className="t" aria-hidden="true">
                {booking.localTime}
                <small>{formatTime(booking.endsAt, timeZone)}</small>
              </span>
              <b aria-hidden="true">
                {booking.patientNameMasked}
                {fresh ? <NewBadge /> : null}
              </b>
              <span className="sub" aria-hidden="true">
                {showDate ? `${formatDayMonth(booking.localDate)} · ` : ""}
                {booking.doctor.name} · {booking.doctor.departmentName}
              </span>
              <span className="booked-ago" aria-hidden="true">
                Booked {bookedAgo(booking.bookedAt, nowMs)}
              </span>
              <span className="status-slot" aria-hidden="true">
                <StatusBadge status={booking.status} />
              </span>
              <span className="go" aria-hidden="true">
                <ChevronRight className="i i-sm" />
              </span>
            </button>
          </li>,
        ];
      })}
    </ul>
  );
}
