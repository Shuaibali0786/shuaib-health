// What may appear in the Bookings page address (FR-021): dates, doctor, department, status and page.
// The search text never does: it is sent in a POST body and lives only in the page's memory.
import { UUID } from "./bffRoutes";
import { BookingStatusSchema, type BookingStatus } from "./schemas";

export type BookingFilters = {
  /** Reference or patient name. Never written to the address. */
  q: string;
  from: string | null;
  to: string | null;
  doctor: string | null;
  department: string | null;
  statuses: BookingStatus[];
  page: number;
};

export const EMPTY_FILTERS: BookingFilters = { q: "", from: null, to: null, doctor: null, department: null, statuses: [], page: 1 };

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const isDate = (value: string | null | undefined): value is string => !!value && DATE.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

/** Reads the address; anything that is not one of the five parameters, or is malformed, is ignored. */
export function parseFilters(params: Record<string, string | string[] | undefined> | URLSearchParams): BookingFilters {
  const get = (name: string) => (params instanceof URLSearchParams ? (params.get(name) ?? undefined) : first(params[name]));
  const from = get("from");
  const to = get("to");
  const doctor = get("doctor");
  const department = get("department");
  const statuses = (get("status") ?? "")
    .split(",")
    .map((value) => BookingStatusSchema.safeParse(value))
    .flatMap((parsed) => (parsed.success ? [parsed.data] : []));
  const page = Number(get("page"));
  return {
    q: "",
    from: isDate(from) ? from : null,
    to: isDate(to) ? to : null,
    doctor: doctor && UUID.test(doctor) ? doctor : null,
    department: department && UUID.test(department) ? department : null,
    statuses: [...new Set(statuses)],
    page: Number.isInteger(page) && page >= 1 && page <= 10000 ? page : 1,
  };
}

/** The query string for the address bar: only the non-personal filters, and only the ones that are set. */
export function filtersToSearch(filters: BookingFilters): string {
  const params = new URLSearchParams();
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  if (filters.doctor) params.set("doctor", filters.doctor);
  if (filters.department) params.set("department", filters.department);
  if (filters.statuses.length) params.set("status", filters.statuses.join(","));
  if (filters.page > 1) params.set("page", String(filters.page));
  return params.toString();
}

/** The POST body of `bookings/search`. */
export function filtersToBody(filters: BookingFilters): Record<string, unknown> {
  const body: Record<string, unknown> = { page: filters.page };
  const q = filters.q.trim();
  if (q) body.q = q;
  if (filters.from) body.from = filters.from;
  if (filters.to) body.to = filters.to;
  if (filters.doctor) body.doctorId = filters.doctor;
  if (filters.department) body.departmentId = filters.department;
  if (filters.statuses.length) body.statuses = filters.statuses;
  return body;
}
