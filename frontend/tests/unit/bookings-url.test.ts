import { describe, expect, it } from "vitest";

import { EMPTY_FILTERS, filtersToBody, filtersToSearch, parseFilters } from "@/admin/lib/bookingsUrl";

const ID = "3f2b8c1e-5a47-4c0b-9d11-0a1b2c3d4e5f";

describe("the Bookings address (FR-021)", () => {
  it("writes only from, to, doctor, department, status and page", () => {
    const search = filtersToSearch({ q: "Ayesha Khan 0300", from: "2026-10-05", to: "2026-10-06", doctor: ID, department: ID, statuses: ["confirmed", "arrived"], page: 3, view: "day", booked: null, sort: "soonest" });
    expect([...new URLSearchParams(search).keys()].sort()).toEqual(["department", "doctor", "from", "page", "status", "to"]);
  });

  it("never writes the search text", () => {
    expect(filtersToSearch({ ...EMPTY_FILTERS, q: "Ayesha" })).toBe("");
    expect(filtersToSearch({ ...EMPTY_FILTERS, q: "0300", statuses: ["arrived"] })).not.toMatch(/Ayesha|0300|q=/);
  });

  it("omits what is not set, so the default view has a clean address", () => {
    expect(filtersToSearch(EMPTY_FILTERS)).toBe("");
    expect(filtersToSearch({ ...EMPTY_FILTERS, page: 1 })).toBe("");
  });

  it("reads back what it wrote and ignores everything else, including a q parameter", () => {
    const filters = parseFilters(new URLSearchParams(`from=2026-10-05&doctor=${ID}&status=confirmed,bogus,confirmed&page=2&q=Ayesha&x=1`));
    expect(filters).toEqual({ q: "", from: "2026-10-05", to: null, doctor: ID, department: null, statuses: ["confirmed"], page: 2, view: "day", booked: null, sort: "soonest" });
  });

  it("rejects malformed values instead of passing them on", () => {
    const filters = parseFilters({ from: "tomorrow", to: "2026-13-99", doctor: "not-a-uuid", page: "-4" });
    expect(filters).toEqual(EMPTY_FILTERS);
  });

  it("sends the search text, and only there, in the POST body", () => {
    expect(filtersToBody({ ...EMPTY_FILTERS, q: "  Ayesha ", doctor: ID, statuses: ["arrived"], page: 2 })).toEqual({ q: "Ayesha", doctorId: ID, statuses: ["arrived"], page: 2 });
  });

  it("writes the view, the recently-booked window and the sort only when they are set (Feature 012)", () => {
    const set = { ...EMPTY_FILTERS, view: "upcoming" as const, booked: 168 as const, sort: "recently_booked" as const };
    expect(Object.fromEntries(new URLSearchParams(filtersToSearch(set)))).toEqual({ view: "upcoming", booked: "7d", sort: "recent" });
    expect(parseFilters(new URLSearchParams("view=upcoming&booked=24h&sort=recent"))).toMatchObject({ view: "upcoming", booked: 24, sort: "recently_booked" });
    expect(parseFilters(new URLSearchParams("view=nope&booked=99h&sort=x"))).toEqual(EMPTY_FILTERS);
  });

  it("sends scope, bookedWithinHours and sort in the search body, and nothing extra by default", () => {
    expect(filtersToBody(EMPTY_FILTERS)).toEqual({ page: 1 });
    expect(filtersToBody({ ...EMPTY_FILTERS, view: "upcoming", booked: 24, sort: "recently_booked" })).toEqual({ page: 1, scope: "upcoming", bookedWithinHours: 24, sort: "recently_booked" });
  });
});
