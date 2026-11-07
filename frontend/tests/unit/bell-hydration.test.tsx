import { act } from "@testing-library/react";
import type { ReactNode } from "react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { BookingsScreen } from "@/admin/bookings/BookingsScreen";
import { EMPTY_FILTERS } from "@/admin/lib/bookingsUrl";
import type { BookingPage, BookingSummary } from "@/admin/lib/schemas";
import { CountCards } from "@/admin/overview/CountCards";
import { NewBookingsBell } from "@/admin/shell/NewBookingsBell";
import { bell } from "@/admin/state/bell";

import { NOW, booking } from "./helpers/overview-fixture";

// Regression for the live React error #418 (hydration mismatch) on /admin/bookings (Feature 012). The shell and its
// bell hydrate first and poll; a page that streams in later used to read that fresh answer during hydration, so it
// rendered a "Mark all seen" button and counts the server's HTML did not have. Each case renders on the "server"
// with an empty bell, gives the bell an answer (as the poll would), then hydrates: React must not report a mismatch.

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => "/admin/bookings" }));
vi.mock("next/link", () => ({ default: ({ href, children, ...rest }: { href: string; children: ReactNode }) => <a href={href} {...rest}>{children}</a> }));

const TZ = "Asia/Karachi";
const seen = (reference: string): BookingSummary => booking(reference, "12:00", "confirmed", { isNew: false, bookedAt: new Date(NOW - 3 * 86_400_000).toISOString() });
const fresh = { ...booking("NEWBOOKNG1", "09:00", "confirmed", { localDate: "2026-10-06" }), isNew: true, bookedAt: new Date(NOW - 3_600_000).toISOString() };

const page: BookingPage = { items: [seen("AAAAAAAAA1"), seen("BBBBBBBBB2")], total: 2, statusCounts: { confirmed: 2 }, page: 1, pageSize: 20 };

/** Server HTML with an empty bell, then the bell's first answer, then hydration. Returns what React reported. */
async function hydrateAfterThePoll(ui: ReactNode): Promise<unknown[]> {
  bell.reset();
  const html = renderToString(ui);
  const container = document.createElement("div");
  container.innerHTML = html;
  document.body.appendChild(container);
  bell.set({ count: 3, items: [fresh] }); // the shell's poll answered before this part hydrated
  const errors: unknown[] = [];
  let root: ReturnType<typeof hydrateRoot> | undefined;
  await act(async () => {
    root = hydrateRoot(container, ui, { onRecoverableError: (error) => errors.push(error) });
  });
  // After hydration the live bell is shown (the mismatch fix must not freeze it at the server's state).
  const shown = container.textContent ?? "";
  await act(async () => root?.unmount());
  container.remove();
  return [errors, shown];
}

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 500 })));
});
afterEach(() => {
  vi.unstubAllGlobals();
  bell.reset();
});

describe("hydrating after the bell has an answer (React #418)", () => {
  it("the Bookings screen matches the server, then shows Mark all seen", async () => {
    const [errors, shown] = await hydrateAfterThePoll(
      <BookingsScreen initialPage={page} lookups={null} initialFilters={EMPTY_FILTERS} demo={false} clinicToday="2026-10-05" timeZone={TZ} serverNow={new Date(NOW).toISOString()} />,
    );
    expect(errors).toEqual([]);
    expect(shown).toContain("Mark all seen");
  });

  it("the count cards match the server, then show the bell's number", async () => {
    const [errors, shown] = await hydrateAfterThePoll(<CountCards cards={{ today: 5, tomorrow: 4, next7Days: 20, newSinceLastVisit: 9, cancelledThisWeek: 1 }} today="2026-10-05" todayLive={5} />);
    expect(errors).toEqual([]);
    expect(shown).toContain("New since last visit");
  });

  it("the bell itself matches the server, then shows its count", async () => {
    const [errors] = await hydrateAfterThePoll(<NewBookingsBell demo={false} timeZone={TZ} />);
    expect(errors).toEqual([]);
    expect(document.querySelector(".bell")).toBeNull(); // unmounted cleanly
  });
});
