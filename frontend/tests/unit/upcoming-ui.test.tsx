import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { BookingCards } from "@/admin/bookings/BookingCard";
import { BookingTable, type BookingListOptions } from "@/admin/bookings/BookingTable";
import { BellStore, bell } from "@/admin/state/bell";
import { NewBookingsBell } from "@/admin/shell/NewBookingsBell";
import { CountCards, weekOf } from "@/admin/overview/CountCards";
import { dayHeading, bookedAgo } from "@/admin/lib/relativeTime";
import { openRequest } from "@/admin/state/openRequest";
import { formatDayMonth } from "@/admin/lib/format";
import type { BookingSummary } from "@/admin/lib/schemas";

import { NOW, booking } from "./helpers/overview-fixture";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }), usePathname: () => "/admin" }));
vi.mock("next/link", () => ({ default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => <a href={href} {...rest}>{children}</a> }));

const TZ = "Asia/Karachi";
const day = (reference: string, localDate: string, hhmm: string, extra: Partial<BookingSummary> = {}): BookingSummary =>
  booking(reference, hhmm, "confirmed", { localDate, bookedAt: new Date(NOW - 2 * 3_600_000).toISOString(), ...extra });

const base = (over: Partial<BookingListOptions> = {}): BookingListOptions => ({ isNew: (b) => b.isNew === true, timeZone: TZ, nowMs: NOW, showDate: false, ...over });

describe("relative time", () => {
  it("says how long ago, in the unit that reads best", () => {
    const t = (ms: number) => bookedAgo(NOW - ms, NOW);
    expect([t(10_000), t(60_000), t(5 * 60_000), t(3_600_000), t(2 * 3_600_000), t(86_400_000), t(3 * 86_400_000), t(15 * 86_400_000)]).toEqual(["just now", "1 minute ago", "5 minutes ago", "1 hour ago", "2 hours ago", "1 day ago", "3 days ago", "2 weeks ago"]);
  });
  it("calls the next day Tomorrow and others by their date", () => {
    expect(dayHeading("2026-10-06", "2026-10-05", formatDayMonth)).toBe("Tomorrow · Tue 6 Oct");
    expect(dayHeading("2026-10-08", "2026-10-05", formatDayMonth)).toBe("Thu 8 Oct");
  });
});

describe("the booking list (Feature 012)", () => {
  const rows = [day("AAAAAAAAA1", "2026-10-06", "09:00", { isNew: true }), day("BBBBBBBBB2", "2026-10-06", "09:30"), day("CCCCCCCCC3", "2026-10-08", "10:00")];
  const groupOf = (date: string) => ({ label: dayHeading(date, "2026-10-05", formatDayMonth), count: date === "2026-10-06" ? 2 : 1 });

  it("the table groups by day with a count, marks New, and shows when each booking was made", () => {
    render(<BookingTable bookings={rows} onOpen={vi.fn()} onQuick={vi.fn()} busyReference={null} {...base({ groupOf })} />);
    const headings = document.querySelectorAll("tr.day-row");
    expect([...headings].map((h) => h.textContent)).toEqual(["Tomorrow · Tue 6 Oct2 bookings", "Thu 8 Oct1 booking"]);
    expect(screen.getAllByTestId("new-badge")).toHaveLength(1);
    expect(screen.getByRole("columnheader", { name: "Booked on" })).toBeTruthy();
    expect(screen.getAllByText("2 hours ago")).toHaveLength(3);
    const first = document.querySelector('tr[data-ref="AAAAAAAAA1"]') as HTMLElement;
    expect(within(first).getByText("New")).toBeTruthy();
  });

  it("without grouping there are no day headings; a search shows each row's date", () => {
    render(<BookingTable bookings={rows} onOpen={vi.fn()} onQuick={vi.fn()} busyReference={null} {...base({ showDate: true })} />);
    expect(document.querySelectorAll("tr.day-row")).toHaveLength(0);
    expect(screen.getAllByText("Tue 6 Oct").length).toBeGreaterThan(0);
  });

  it("the phone cards group the same way and say New and Booked in words", () => {
    render(<BookingCards bookings={rows} onOpen={vi.fn()} {...base({ groupOf })} />);
    expect(screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent)).toEqual(["Tomorrow · Tue 6 Oct2 bookings", "Thu 8 Oct1 booking"]);
    const card = document.querySelector('button[data-ref="AAAAAAAAA1"]') as HTMLElement;
    expect(card.getAttribute("aria-label")).toMatch(/^New booking\. .*Booked 2 hours ago/);
    expect(document.querySelector('button[data-ref="BBBBBBBBB2"]')!.getAttribute("aria-label")).not.toMatch(/New booking/);
  });
});

describe("the bell store", () => {
  const item = (reference: string, hoursAgo: number) => ({ ...day(reference, "2026-10-06", "09:00", { isNew: true }), bookedAt: new Date(NOW - hoursAgo * 3_600_000).toISOString() });
  const fresh = () => new BellStore();

  it("takes the server's count and shows it", () => {
    const store = fresh();
    store.set({ count: 7, items: [item("AAAAAAAAA1", 1), item("BBBBBBBBB2", 2)] });
    expect(store.current()).toMatchObject({ count: 7 });
  });

  it("opening a booking takes one off, for the list row too, until the server answers", () => {
    const store = fresh();
    const first = item("AAAAAAAAA1", 1);
    store.set({ count: 3, items: [first, item("BBBBBBBBB2", 2)] });
    expect(store.isNew(first)).toBe(true);
    store.markOpened("AAAAAAAAA1");
    expect(store.isNew(first)).toBe(false);
    expect(store.current()).toMatchObject({ count: 2 });
    expect(store.current()?.items.map((i) => i.reference)).toEqual(["BBBBBBBBB2"]);
    store.set({ count: 2, items: [item("BBBBBBBBB2", 2)] });
    expect(store.current()).toMatchObject({ count: 2 });
  });

  it("Mark all seen clears the count and every row booked before it", () => {
    const store = fresh();
    const old = item("AAAAAAAAA1", 1);
    store.set({ count: 5, items: [old] });
    store.markAll(NOW);
    expect(store.current()).toEqual({ count: 0, items: [] });
    expect(store.isNew(old)).toBe(false);
    expect(store.isNew({ ...old, bookedAt: new Date(NOW + 60_000).toISOString() })).toBe(true); // a later booking is new again
  });
});

describe("the bell in the top bar", () => {
  beforeEach(() => {
    push.mockClear();
    openRequest.reset();
    bell.reset();
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 500 })));
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    bell.reset();
  });

  const seed = () =>
    act(() => {
      bell.set({
        count: 4,
        items: [{ ...day("AAAAAAAAA1", "2026-10-06", "09:00", { isNew: true }), bookedAt: new Date(NOW - 2 * 3_600_000).toISOString() }],
      });
    });

  it("shows the number, lists the newest with when they were booked, and opens one in the drawer", async () => {
    render(<NewBookingsBell demo={false} timeZone={TZ} />);
    seed();
    const button = await screen.findByRole("button", { name: "New bookings: 4" });
    expect(button.textContent).toContain("4");
    await userEvent.click(button);
    const item = screen.getByRole("button", { name: /Khadija N\./ });
    expect(item.textContent).toMatch(/Mon 5 Oct, 09:00/);
    expect(item.textContent).toMatch(/Booked .+ ago|Booked just now/);
    await userEvent.click(item);
    expect(push).toHaveBeenCalledWith("/admin/bookings");
    expect(openRequest.take()?.reference).toBe("AAAAAAAAA1");
  });

  it("with nothing new it says so and offers no Mark all seen", async () => {
    render(<NewBookingsBell demo timeZone={TZ} />);
    act(() => bell.set({ count: 0, items: [] }));
    await userEvent.click(await screen.findByRole("button", { name: "New bookings: none" }));
    expect(screen.getByText("No new bookings")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Mark all seen" })).toBeNull();
  });
});

describe("the count cards", () => {
  it("finds Monday and Sunday of the week", () => {
    expect(weekOf("2026-10-05")).toEqual({ monday: "2026-10-05", sunday: "2026-10-11" });
    expect(weekOf("2026-10-11")).toEqual({ monday: "2026-10-05", sunday: "2026-10-11" });
    expect(weekOf("2026-10-07")).toEqual({ monday: "2026-10-05", sunday: "2026-10-11" });
  });

  it("shows the five numbers, each linking to the list it counts", () => {
    bell.reset();
    render(<CountCards cards={{ today: 50, tomorrow: 31, next7Days: 210, newSinceLastVisit: 9, cancelledThisWeek: 4 }} today="2026-10-05" todayLive={52} />);
    const link = (id: string) => (document.querySelector(`[data-count="${id}"]`) as HTMLAnchorElement).getAttribute("href");
    expect(screen.getByText("Today")).toBeTruthy();
    expect(screen.getByText("Cancelled this week")).toBeTruthy();
    expect(link("today")).toBe("/admin/bookings");
    expect(link("tomorrow")).toBe("/admin/bookings?from=2026-10-06&to=2026-10-06");
    expect(link("next7")).toBe("/admin/bookings?from=2026-10-06&to=2026-10-12");
    expect(link("new")).toBe("/admin/bookings?view=upcoming&sort=recent");
    expect(link("cancelled")).toBe("/admin/bookings?from=2026-10-05&to=2026-10-11&status=cancelled");
  });
});
