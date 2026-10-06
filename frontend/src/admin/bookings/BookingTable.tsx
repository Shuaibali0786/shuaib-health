import type { BookingSummary } from "@/admin/lib/schemas";

import { StatusBadge } from "./StatusBadge";
import { quickAction } from "./StatusActions";

/** The desktop list: time in display numerals, the patient's name as the button that opens the drawer. */
export function BookingTable({ bookings, onOpen, onQuick, busyReference }: { bookings: BookingSummary[]; onOpen: (booking: BookingSummary, opener: HTMLElement) => void; onQuick: (booking: BookingSummary, to: "arrived" | "completed") => void; busyReference: string | null }) {
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
            <th scope="col">Status</th>
            <th scope="col">
              <span className="sr-only">Quick action</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {bookings.map((booking) => {
            const quick = quickAction(booking.allowedNext);
            return (
              <tr key={booking.reference} data-ref={booking.reference}>
                <td>
                  <span className="t">{booking.localTime}</span>
                </td>
                <td className="pt">
                  <button type="button" className="pt-open" onClick={(event) => onOpen(booking, event.currentTarget)}>
                    {booking.patientNameMasked}
                  </button>
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
                  <StatusBadge status={booking.status} />
                </td>
                <td>
                  {quick ? (
                    <button type="button" className="btn btn-sm" disabled={busyReference === booking.reference} onClick={() => onQuick(booking, quick.to as "arrived" | "completed")} aria-label={`${quick.label}: ${booking.patientNameMasked}, ${booking.localTime}`}>
                      {quick.label}
                    </button>
                  ) : (
                    <span className="muted" aria-label="No quick action">
                      —
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
