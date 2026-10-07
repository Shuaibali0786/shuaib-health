import { describe, expect, it } from "vitest";

import { EMPTY_FILTERS } from "@/admin/lib/bookingsUrl";
import type { BookingStatus, BookingSummary } from "@/admin/lib/schemas";
import { mergeIntoPage, simulatedMatching, withSimulatedCounts, type StatusCounts } from "@/admin/bookings/simulated";
import { countStatuses, deriveOverview } from "@/admin/overview/model";

import { DATE, MIRZA, NOW, RAHMAN, booking, overview, row } from "./helpers/overview-fixture";

// One set of numbers (spec 006, data consistency): the Overview, Bookings and Today-by-status must count the same
// bookings for the same day, including the bookings the demo simulates in the browser and the visitor's own
// status changes.

const PAGE_SIZE = 5;

/** The server's day: 12 bookings, five of them on the first page, in the server's order (time, doctor, reference). */
const SERVER = [
  booking("D01", "09:00", "completed"),
  booking("D02", "09:15", "completed", { doctor: RAHMAN }),
  booking("D03", "09:30", "arrived"),
  booking("D04", "10:00", "cancelled", { doctor: RAHMAN }),
  booking("D05", "10:15", "no_show"),
  booking("D06", "11:40", "confirmed"),
  booking("D07", "11:45", "confirmed", { doctor: RAHMAN }),
  booking("D08", "12:00", "cancelled"),
  booking("D09", "12:15", "confirmed", { doctor: RAHMAN }),
  booking("D10", "13:00", "confirmed"),
  booking("D11", "14:00", "confirmed", { doctor: RAHMAN }),
  booking("D12", "14:15", "confirmed"),
];
const SIMULATED = [booking("DX01", "12:30", "confirmed", { doctor: RAHMAN }), booking("DX02", "15:00", "confirmed"), booking("DX03", "08:45", "confirmed")];

const agendaOf = (items: BookingSummary[]) => [row(MIRZA, [["09:00", "18:00"]], items.filter((b) => b.doctor.id === MIRZA.id)), row(RAHMAN, [["09:00", "18:00"]], items.filter((b) => b.doctor.id === RAHMAN.id))];

function serverCounts(items: BookingSummary[]): StatusCounts {
  const counts: StatusCounts = {};
  for (const item of items) counts[item.status] = (counts[item.status] ?? 0) + 1;
  return counts;
}

/** What the Overview screen shows for this demo state. */
function overviewSide(extras: BookingSummary[], changes: Record<string, BookingStatus>) {
  const statusOf = (reference: string, status: BookingStatus) => changes[reference] ?? status;
  const view = deriveOverview(overview(agendaOf(SERVER)), { nowMs: NOW, statusOf, extras });
  const items = view.agenda.flatMap((r) => r.items);
  return { total: items.length, counts: countStatuses(items), appointments: view.kpis.appointments.value, cancellations: view.kpis.cancellations.value };
}

/** What the Bookings screen shows on the given page (the server sends `PAGE_SIZE` rows per page). */
function bookingsSide(extras: BookingSummary[], changes: Record<string, BookingStatus>, page: number) {
  const statusOf = (reference: string, status: BookingStatus) => changes[reference] ?? status;
  const simulated = simulatedMatching(extras, EMPTY_FILTERS, { today: DATE, departmentName: null, statusOf, nameOf: () => undefined });
  const pages = Math.ceil(SERVER.length / PAGE_SIZE);
  const rows = SERVER.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map((b) => ({ ...b, status: changes[b.reference] ?? b.status }));
  const shown = mergeIntoPage(rows, simulated, page, pages);
  const counts = withSimulatedCounts(serverCounts(SERVER.map((b) => ({ ...b, status: changes[b.reference] ?? b.status }))), simulated);
  return { total: SERVER.length + simulated.length, counts, shown, simulated };
}

const sum = (counts: StatusCounts) => Object.values(counts).reduce((a, b) => a + (b ?? 0), 0);

describe("Overview, Bookings and Today-by-status agree", () => {
  const scenarios: [string, BookingSummary[], Record<string, BookingStatus>][] = [
    ["no simulated bookings", [], {}],
    ["one simulated booking", [SIMULATED[0]!], {}],
    ["three simulated bookings", SIMULATED, {}],
    ["simulated bookings and the visitor's own changes", SIMULATED, { D06: "arrived", D07: "cancelled", DX01: "cancelled", DX02: "arrived" }],
  ];

  it.each(scenarios)("%s", (_name, extras, changes) => {
    const o = overviewSide(extras, changes);
    const b = bookingsSide(extras, changes, 1);
    expect(b.total).toBe(o.total);
    expect(sum(b.counts)).toBe(o.total);
    for (const status of ["confirmed", "arrived", "completed", "no_show", "cancelled"] as const) expect(b.counts[status] ?? 0).toBe(o.counts[status]);
    expect(o.appointments).toBe(o.total - o.counts.cancelled);
    expect(o.cancellations).toBe(o.counts.cancelled);
  });

  it("the Bookings rows over all pages are exactly the Overview's bookings", () => {
    const pages = Math.ceil(SERVER.length / PAGE_SIZE);
    const shown = Array.from({ length: pages }, (_, index) => bookingsSide(SIMULATED, {}, index + 1).shown.map((b) => b.reference)).flat();
    const overviewRefs = deriveOverview(overview(agendaOf(SERVER)), { nowMs: NOW, extras: SIMULATED }).agenda.flatMap((r) => r.items.map((b) => b.reference));
    expect([...shown].sort()).toEqual([...overviewRefs].sort());
    expect(new Set(shown).size).toBe(shown.length); // none listed twice
  });
});

describe("simulated bookings follow the Bookings filters", () => {
  const statusOf = (_reference: string, status: BookingStatus) => status;
  const options = { today: DATE, departmentName: null, statusOf, nameOf: (reference: string) => (reference === "DX01" ? "Ayesha Khan" : undefined) };

  it("another day lists none", () => {
    expect(simulatedMatching(SIMULATED, { ...EMPTY_FILTERS, from: "2026-10-06" }, options)).toEqual([]);
    expect(simulatedMatching(SIMULATED, { ...EMPTY_FILTERS, from: "2026-10-04", to: "2026-10-06" }, options)).toHaveLength(3);
  });

  it("by doctor, department and text", () => {
    expect(simulatedMatching(SIMULATED, { ...EMPTY_FILTERS, doctor: RAHMAN.id }, options).map((b) => b.reference)).toEqual(["DX01"]);
    expect(simulatedMatching(SIMULATED, { ...EMPTY_FILTERS, department: "dept-id" }, { ...options, departmentName: "Gynecology" }).map((b) => b.reference)).toEqual(["DX01"]);
    expect(simulatedMatching(SIMULATED, { ...EMPTY_FILTERS, q: "ayesha" }, options).map((b) => b.reference)).toEqual(["DX01"]);
    expect(simulatedMatching(SIMULATED, { ...EMPTY_FILTERS, q: "dx02" }, options).map((b) => b.reference)).toEqual(["DX02"]);
  });

  it("are listed in time order", () => {
    expect(simulatedMatching(SIMULATED, EMPTY_FILTERS, options).map((b) => b.reference)).toEqual(["DX03", "DX01", "DX02"]);
  });
});
