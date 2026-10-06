// @vitest-environment node
import { describe, expect, it } from "vitest";

import { DemoOverlay } from "@/admin/state/demoOverlay";

// The demo is read-only on the server. Status changes a visitor makes are kept here, in memory, on top of
// the server's sample data, keyed by booking reference (spec FR-038/FR-039; ADR-0009).

const clock = (start = 1_000_000) => {
  let now = start;
  return { now: () => now, advance: (ms: number) => (now += ms) };
};
const booking = { reference: "D0000000001", status: "confirmed" as const };

describe("DemoOverlay", () => {
  it("shows the server status until a change is made, then the local one", () => {
    const overlay = new DemoOverlay(clock().now);
    expect(overlay.apply(booking).status).toBe("confirmed");
    overlay.setStatus(booking.reference, "confirmed", "arrived");
    expect(overlay.apply(booking).status).toBe("arrived");
    expect(overlay.apply({ reference: "D0000000002", status: "confirmed" as const }).status).toBe("confirmed");
  });

  it("does not change the object it was given", () => {
    const overlay = new DemoOverlay(clock().now);
    overlay.setStatus(booking.reference, "confirmed", "no_show");
    overlay.apply(booking);
    expect(booking.status).toBe("confirmed");
  });

  it("keeps a history, oldest first, for the drawer", () => {
    const time = clock();
    const overlay = new DemoOverlay(time.now);
    overlay.setStatus(booking.reference, "confirmed", "arrived");
    time.advance(60_000);
    overlay.setStatus(booking.reference, "arrived", "completed");
    expect(overlay.history(booking.reference).map((change) => [change.from, change.to, change.isUndo])).toEqual([
      ["confirmed", "arrived", false],
      ["arrived", "completed", false],
    ]);
    expect(overlay.history("D0000000009")).toEqual([]);
  });

  it("undoes the latest change within ten seconds and records the undo", () => {
    const time = clock();
    const overlay = new DemoOverlay(time.now);
    overlay.setStatus(booking.reference, "confirmed", "arrived");
    time.advance(9_999);
    expect(overlay.canUndo(booking.reference)).toBe(true);
    expect(overlay.undo(booking.reference)).toBe("confirmed");
    expect(overlay.apply(booking).status).toBe("confirmed");
    expect(overlay.history(booking.reference).at(-1)).toMatchObject({ from: "arrived", to: "confirmed", isUndo: true });
    expect(overlay.canUndo(booking.reference)).toBe(false); // an undo cannot be undone
    expect(overlay.undo(booking.reference)).toBeNull();
  });

  it("refuses an undo after ten seconds", () => {
    const time = clock();
    const overlay = new DemoOverlay(time.now);
    overlay.setStatus(booking.reference, "confirmed", "arrived");
    time.advance(10_001);
    expect(overlay.canUndo(booking.reference)).toBe(false);
    expect(overlay.undo(booking.reference)).toBeNull();
    expect(overlay.apply(booking).status).toBe("arrived");
  });

  it("only the latest change can be undone", () => {
    const time = clock();
    const overlay = new DemoOverlay(time.now);
    overlay.setStatus(booking.reference, "confirmed", "arrived");
    overlay.setStatus(booking.reference, "arrived", "completed");
    expect(overlay.undo(booking.reference)).toBe("arrived");
    expect(overlay.canUndo(booking.reference)).toBe(false);
  });

  it("lives in memory only: a new store is empty", () => {
    const first = new DemoOverlay(clock().now);
    first.setStatus(booking.reference, "confirmed", "cancelled");
    const second = new DemoOverlay(clock().now);
    expect(second.apply(booking).status).toBe("confirmed");
    expect(second.history(booking.reference)).toEqual([]);
    first.reset();
    expect(first.apply(booking).status).toBe("confirmed");
  });

  it("tells subscribers about every change, and gives React a stable snapshot between changes", () => {
    const overlay = new DemoOverlay(clock().now);
    let calls = 0;
    const stop = overlay.subscribe(() => (calls += 1));
    const before = overlay.getSnapshot();
    expect(overlay.getSnapshot()).toBe(before);
    overlay.setStatus(booking.reference, "confirmed", "arrived");
    overlay.undo(booking.reference);
    expect(calls).toBe(2);
    expect(overlay.getSnapshot()).not.toBe(before);
    stop();
    overlay.setStatus(booking.reference, "confirmed", "arrived");
    expect(calls).toBe(2);
  });

  it("ignores a change to the status the booking already has", () => {
    const overlay = new DemoOverlay(clock().now);
    expect(overlay.setStatus(booking.reference, "confirmed", "confirmed")).toBeNull();
    expect(overlay.history(booking.reference)).toEqual([]);
  });
});
