import { clinicDate, formatDayMonth, formatTime } from "@/admin/lib/format";
import { bookedAgo } from "@/admin/lib/relativeTime";
import type { BookingSummary } from "@/admin/lib/schemas";

import { NewBadge } from "./NewBadge";
import { StatusBadge } from "./StatusBadge";
import { quickAction } from "./StatusActions";

/** One heading of the Upcoming view: the label ("Tomorrow · Tue 6 Oct") and how many bookings that day has. */
export type DayGroup = { label: string; count: number };

export type BookingListOptions = {
  /** Whether a row is New for the signed-in staff member. */
  isNew: (booking: BookingSummary) => boolean;
  timeZone: string;
  nowMs: number;
  /** Show each row's date (a search or "Recently booked" lists several days). */
  showDate: boolean;
  /** Upcoming view: a heading before the first row of each day. */
  groupOf?: (date: string) => DayGroup;
};

/** The desktop list: time in display numerals, the patient's name as the button that opens the drawer. */
export function BookingTable({
  bookings,
  onOpen,
  onQuick,
  busyReference,
  isNew,
  timeZone,
  nowMs,
  showDate,
  groupOf,
}: { bookings: BookingSummary[]; onOpen: (booking: BookingSummary, opener: HTMLElement) => void; onQuick: (booking: BookingSummary, to: "arrived" | "completed") => void; busyReference: string | null } & BookingListOptions) {
  return (
    <div className="table-wrap">
      <table className="bk">
        <caption className="sr-only">Bookings</caption>
        <thead>
          <tr>
            <th scope="col">Time</th>
            <th scope="col">Patient</th>
            <th scope="col">Doctor</th>
            <th scope="col">Reference</th>
            <th scope="col">Booked on</th>
            <th scope="col">Status</th>
            <th scope="col">
              <span className="sr-only">Quick action</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {bookings.map((booking, index) => {
            const quick = quickAction(booking.allowedNext);
            const fresh = isNew(booking);
            const heading = groupOf && bookings[index - 1]?.localDate !== booking.localDate ? groupOf(booking.localDate) : null;
            return [
              heading ? (
                <tr key={`day-${booking.localDate}`} className="day-row">
                  <th scope="colgroup" colSpan={7}>
                    <span className="day-label">{heading.label}</span>
                    <span className="day-count">
                      {heading.count} {heading.count === 1 ? "booking" : "bookings"}
                    </span>
                  </th>
                </tr>
              ) : null,
              <tr key={booking.reference} data-ref={booking.reference} data-new={fresh ? "true" : undefined}>
                <td>
                  {showDate ? <div className="muted sub-line">{formatDayMonth(booking.localDate)}</div> : null}
                  <span className="t">{booking.localTime}</span>
                </td>
                <td className="pt">
                  <button type="button" className="pt-open" onClick={(event) => onOpen(booking, event.currentTarget)}>
                    {booking.patientNameMasked}
                  </button>
                  {fresh ? <NewBadge /> : null}
                  {booking.isSample ? <span className="sample">Sample</span> : null}
                  <div className="muted sub-line">{booking.phoneMasked}</div>
                </td>
                <td>
                  {booking.doctor.name}
                  <div className="muted sub-line">{booking.doctor.departmentName}</div>
                </td>
                <td>
                  <span className="ref">{booking.reference}</span>
                </td>
                <td>
                  <span className="booked-on">
                    {formatDayMonth(clinicDate(booking.bookedAt, timeZone))}, {formatTime(booking.bookedAt, timeZone)}
                  </span>
                  <div className="muted sub-line">{bookedAgo(booking.bookedAt, nowMs)}</div>
                </td>
                <td>
                  <StatusBadge status={booking.status} />
                </td>
                <td>
                  <div className="row-actions">
                    {quick ? (
                      <button type="button" className="btn btn-sm" disabled={busyReference === booking.reference} onClick={() => onQuick(booking, quick.to as "arrived" | "completed")} aria-label={`${quick.label}: ${booking.patientNameMasked}, ${booking.localTime}`}>
                        {quick.label}
                      </button>
                    ) : null}
                    <button type="button" className="btn btn-sm btn-quiet" data-view="" onClick={(event) => onOpen(booking, event.currentTarget)} aria-label={`View booking: ${booking.patientNameMasked}, ${booking.localTime}`}>
                      View
                    </button>
                  </div>
                </td>
              </tr>,
            ];
          })}
        </tbody>
      </table>
    </div>
  );
}
