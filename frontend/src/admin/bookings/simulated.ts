// The demo's simulated online bookings exist only in the browser (demoOverlay), so the server's Bookings
// answer never contains them. These pure helpers lay them over that answer, so the Bookings list, its
// status chips and its total count the same bookings as the Overview does for the same day.
import type { BookingFilters } from "@/admin/lib/bookingsUrl";
import type { BookingStatus, BookingSummary } from "@/admin/lib/schemas";

export type StatusCounts = Partial<Record<BookingStatus, number>>;

export type SimulatedOptions = {
  /** The clinic's today, `YYYY-MM-DD`: the day shown when the filters name none. */
  today: string;
  /** The department the filter names (the filter holds an id, a booking only knows the name). */
  departmentName: string | null;
  /** The visitor's own status for a booking (the demo overlay laid over the simulated one). */
  statusOf: (reference: string, status: BookingStatus) => BookingStatus;
  /** The full patient name of a simulated booking, for the search box. */
  nameOf: (reference: string) => string | undefined;
};

const order = (a: BookingSummary, b: BookingSummary) => a.startsAt.localeCompare(b.startsAt) || a.doctor.name.localeCompare(b.doctor.name) || a.reference.localeCompare(b.reference);

/**
 * The simulated bookings the current filters (everything but the status chips) would list, with the visitor's
 * own status laid over each. The same rules as the server's search: the day range, the doctor, the department
 * and the text (reference or name).
 */
export function simulatedMatching(extras: readonly BookingSummary[], filters: BookingFilters, { today, departmentName, statusOf, nameOf }: SimulatedOptions): BookingSummary[] {
  const first = filters.from ?? filters.to ?? today;
  const last = filters.to ?? first;
  const term = filters.q.trim().toLowerCase();
  return extras
    .filter((item) => item.localDate >= first && item.localDate <= last)
    .filter((item) => !filters.doctor || item.doctor.id === filters.doctor)
    .filter((item) => !filters.department || item.doctor.departmentName === departmentName)
    .filter((item) => !term || item.reference.toLowerCase().includes(term) || (nameOf(item.reference) ?? item.patientNameMasked).toLowerCase().includes(term))
    .map((item) => {
      const status = statusOf(item.reference, item.status);
      return status === item.status ? item : { ...item, status };
    })
    .sort(order);
}

/**
 * The page's rows with the simulated bookings that belong on it. The server pages by start time, so a page
 * knows only its own first and last row: the first page also takes the bookings before its first row, the last
 * page those after its last, and any other page those that fall between its rows.
 */
export function mergeIntoPage(rows: readonly BookingSummary[], simulated: readonly BookingSummary[], page: number, pages: number): BookingSummary[] {
  if (simulated.length === 0) return [...rows];
  const firstRow = rows[0];
  const lastRow = rows.at(-1);
  if (!firstRow || !lastRow) return page === 1 ? [...simulated] : [...rows];
  const here = simulated.filter((item) => (page === 1 || order(item, firstRow) >= 0) && (page >= pages || order(item, lastRow) <= 0));
  return [...rows, ...here].sort(order);
}

/** The status chips: the server's counts with the simulated bookings (already in their current status) added. */
export function withSimulatedCounts(counts: StatusCounts, simulated: readonly BookingSummary[]): StatusCounts {
  const next: StatusCounts = { ...counts };
  for (const item of simulated) next[item.status] = (next[item.status] ?? 0) + 1;
  return next;
}
