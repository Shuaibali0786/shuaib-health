import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { formatClock } from "@/admin/lib/format";
import { ClinicClock } from "@/admin/state/clinicClock";

// Mon 5 Oct 2026, 11:20:45 in the clinic (Asia/Karachi, UTC+5).
const SERVER_NOW = Date.parse("2026-10-05T06:20:45Z");
// A device whose clock is hours off: it thinks it is 15:00 UTC.
const WRONG_DEVICE = new Date("2026-10-05T15:00:00Z");

let clock: ClinicClock;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(WRONG_DEVICE);
  clock = new ClinicClock();
  clock.seed(SERVER_NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("clinic clock: now", () => {
  it("is the server time, not the device time, whatever the device clock says", () => {
    expect(clock.now()).toBe(SERVER_NOW);
    expect(formatClock(clock.now())).toBe("11:20:45 AM");
    vi.advanceTimersByTime(5000);
    expect(formatClock(clock.now())).toBe("11:20:50 AM");
  });

  it("keeps the offset fixed while time flows with the device", () => {
    const before = clock.now();
    vi.setSystemTime(new Date(WRONG_DEVICE.getTime() + 60_000));
    expect(clock.now() - before).toBe(60_000);
  });

  it("can be re-seeded", () => {
    clock.seed(Date.parse("2026-10-05T07:00:00Z"));
    expect(formatClock(clock.now())).toBe("12:00:00 PM");
  });

  it("accounts for the time between the server rendering and the client reading it", () => {
    clock.seed(SERVER_NOW, WRONG_DEVICE.getTime() - 1500); // the server instant was 1.5 s of device time ago
    expect(clock.now()).toBe(SERVER_NOW + 1500);
  });
});

describe("clinic clock: ticking", () => {
  it("ticks once a second, with the server-corrected time", () => {
    const seen: string[] = [];
    clock.subscribe((now) => seen.push(formatClock(now)));
    vi.advanceTimersByTime(3000);
    expect(seen).toEqual(["11:20:46 AM", "11:20:47 AM", "11:20:48 AM"]);
  });

  it("shares one interval between any number of listeners and stops it with the last one", () => {
    const stops = [1, 2, 3, 4, 5].map(() => clock.subscribe(() => {}));
    expect(vi.getTimerCount()).toBe(1);
    stops.slice(0, 4).forEach((stop) => stop());
    expect(vi.getTimerCount()).toBe(1);
    stops[4]!();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("stops calling a listener that unsubscribed", () => {
    const listener = vi.fn();
    const stop = clock.subscribe(listener);
    vi.advanceTimersByTime(2000);
    stop();
    vi.advanceTimersByTime(5000);
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("gives a stable snapshot between ticks (useSyncExternalStore requires it)", () => {
    clock.subscribe(() => {});
    const first = clock.getSnapshot();
    expect(clock.getSnapshot()).toBe(first);
    vi.advanceTimersByTime(1000);
    expect(clock.getSnapshot()).toBe(first + 1000);
  });

  it("refreshes the snapshot when a listener subscribes after a long pause", () => {
    clock.subscribe(() => {})();
    vi.advanceTimersByTime(60_000);
    clock.subscribe(() => {});
    expect(clock.getSnapshot()).toBe(clock.now());
  });
});

describe("clinic clock: minute boundaries", () => {
  it("emits at each minute boundary of clinic time and not in between", () => {
    const minutes: string[] = [];
    clock.onMinute((now) => minutes.push(formatClock(now)));
    vi.advanceTimersByTime(14_000); // 11:20:59
    expect(minutes).toEqual([]);
    vi.advanceTimersByTime(1000); // 11:21:00
    expect(minutes).toEqual(["11:21:00 AM"]);
    vi.advanceTimersByTime(60_000);
    expect(minutes).toEqual(["11:21:00 AM", "11:22:00 AM"]);
  });

  it("does not emit a minute just because the clock was seeded", () => {
    const minute = vi.fn();
    clock.onMinute(minute);
    clock.seed(Date.parse("2026-10-05T08:00:30Z"));
    vi.advanceTimersByTime(1000);
    expect(minute).not.toHaveBeenCalled();
  });
});

describe("clinic clock: new clinic day", () => {
  it("emits once when the date changes in clinic time, with the new date", () => {
    // 23:59:58 in Karachi on the 5th is 18:59:58 UTC, still the 5th in UTC.
    clock.seed(Date.parse("2026-10-05T18:59:58Z"));
    const days: string[] = [];
    clock.onNewDay((date) => days.push(date));
    vi.advanceTimersByTime(1000);
    expect(days).toEqual([]);
    vi.advanceTimersByTime(1000); // 00:00:00 on the 6th
    expect(days).toEqual(["2026-10-06"]);
    vi.advanceTimersByTime(3_600_000);
    expect(days).toEqual(["2026-10-06"]);
  });

  it("follows the clinic day, not the device day or UTC", () => {
    // 20:00 UTC on the 5th is already the 6th in Karachi, so no day change is announced 30 s later.
    clock.seed(Date.parse("2026-10-05T20:00:00Z"));
    const days = vi.fn();
    clock.onNewDay(days);
    vi.advanceTimersByTime(30_000);
    expect(days).not.toHaveBeenCalled();
  });
});
