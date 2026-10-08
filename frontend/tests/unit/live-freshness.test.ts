import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ClinicClock } from "@/admin/state/clinicClock";
import { LivePoller, documentVisibility, formatUpdatedAgo, type Visibility } from "@/admin/state/livePoll";

const DEVICE_START = Date.parse("2026-10-05T06:20:00Z");
const SERVER_AHEAD_MS = 3 * 60_000; // a device clock three minutes behind the clinic

const alwaysVisible: Visibility = { isVisible: () => true, subscribe: () => () => {} };

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(DEVICE_START);
});
afterEach(() => vi.useRealTimers());

describe("live freshness", () => {
  it("measures 'updated N ago' on the clinic clock, so a skewed device clock never shows 'updated 3 min ago'", async () => {
    const clock = new ClinicClock();
    clock.seed(DEVICE_START + SERVER_AHEAD_MS, Date.now());
    const poller = new LivePoller<string>({ load: async () => "data", onData: () => {}, visibility: alwaysVisible, now: () => clock.now() });
    poller.start();
    await vi.advanceTimersByTimeAsync(30_000); // one poll
    const age = clock.now() - poller.getStatus().lastSuccessAt;
    expect(formatUpdatedAgo(age)).toBe("updated just now");
    await vi.advanceTimersByTimeAsync(20_000);
    expect(formatUpdatedAgo(clock.now() - poller.getStatus().lastSuccessAt)).toBe("updated 20 s ago");
    poller.stop();
  });

  it("polls every 30 s while visible: three polls in 90 s", async () => {
    const load = vi.fn(async () => "data");
    const poller = new LivePoller<string>({ load, onData: () => {}, visibility: alwaysVisible });
    poller.start();
    await vi.advanceTimersByTimeAsync(90_000);
    expect(load).toHaveBeenCalledTimes(3);
    poller.stop();
  });

  it("fetches at once when the window regains focus", async () => {
    const load = vi.fn(async () => "data");
    const poller = new LivePoller<string>({ load, onData: () => {}, visibility: documentVisibility });
    poller.start();
    expect(load).not.toHaveBeenCalled();
    window.dispatchEvent(new Event("focus"));
    await vi.advanceTimersByTimeAsync(0);
    expect(load).toHaveBeenCalledTimes(1);
    poller.stop();
  });

  it("moves the Now line every minute with the clock", () => {
    const clock = new ClinicClock();
    clock.seed(DEVICE_START + SERVER_AHEAD_MS, Date.now());
    const minutes: number[] = [];
    const off = clock.onMinute((ms) => minutes.push(ms));
    vi.advanceTimersByTime(3 * 60_000);
    off();
    expect(minutes).toHaveLength(3);
    expect(minutes.map((ms) => Math.floor(ms / 60_000))).toEqual([1, 2, 3].map((n) => Math.floor((DEVICE_START + SERVER_AHEAD_MS) / 60_000) + n));
  });
});
