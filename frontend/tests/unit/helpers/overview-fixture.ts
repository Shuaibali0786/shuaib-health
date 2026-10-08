import type { AgendaDoctor, BookingStatus, BookingSummary, Kpis, Overview, RecentBooking, Trend } from "@/admin/lib/schemas";

/** Mon 5 Oct 2026, 11:20:45 in the clinic (Asia/Karachi, UTC+5). */
export const NOW = Date.parse("2026-10-05T06:20:45Z");
export const DATE = "2026-10-05";
/** Clinic midnight of DATE. */
export const MIDNIGHT = Date.parse("2026-10-04T19:00:00Z");

export const MIRZA = { id: "00000000-0000-4000-8000-000000000001", name: "Dr. Hassan Mirza", departmentName: "General Medicine" };
export const RAHMAN = { id: "00000000-0000-4000-8000-000000000002", name: "Dr. Ayesha Rahman", departmentName: "Gynecology" };

/** A 15-minute booking today at `hhmm` clinic time. */
export function booking(reference: string, hhmm: string, status: BookingStatus = "confirmed", overrides: Partial<BookingSummary> = {}): BookingSummary {
  const [h = 0, m = 0] = hhmm.split(":").map(Number);
  const startsAt = MIDNIGHT + (h * 60 + m) * 60_000;
  return {
    reference,
    startsAt: new Date(startsAt).toISOString(),
    endsAt: new Date(startsAt + 15 * 60_000).toISOString(),
    localDate: DATE,
    localTime: hhmm,
    status,
    version: 1,
    patientNameMasked: "Khadija N.",
    phoneMasked: "0300****567",
    doctor: MIRZA,
    allowedNext: [],
    isSample: true,
    ...overrides,
  };
}

export const row = (doctor: AgendaDoctor["doctor"], sessions: [string, string][], items: BookingSummary[]): AgendaDoctor => ({
  doctor,
  sessions: sessions.map(([start, end]) => ({ start, end })),
  items,
});

const trend = (value: number | null, previous: number | null): Trend => ({ value, previous, delta: value === null || previous === null ? null : value - previous, comparedTo: "2026-09-28" });

export const kpis = (overrides: Partial<Kpis> = {}): Kpis => ({
  appointments: trend(50, 54),
  arrived: trend(8, 8),
  completed: trend(8, 8),
  noShows: trend(2, 4),
  cancellations: trend(5, 4),
  utilisationPct: trend(72, 78),
  ...overrides,
});

export function overview(agenda: AgendaDoctor[], overrides: Partial<Overview> = {}): Overview {
  return {
    localDate: DATE,
    now: new Date(NOW).toISOString(),
    clinicClosed: null,
    kpis: kpis(),
    agenda,
    nextUp: [],
    recentBookings: [],
    isSample: true,
    ...overrides,
  };
}

export const recent = (reference: string, bookedAt: string, overrides: Partial<RecentBooking> = {}): RecentBooking => ({ ...booking(reference, "12:20"), bookedAt, ...overrides });
