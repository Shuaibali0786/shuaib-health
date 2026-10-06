import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LivePoller, formatUpdatedAgo, type Visibility } from "@/admin/state/livePoll";

class FakeVisibility implements Visibility {
  visible = true;
  private listeners = new Set<() => void>();
  isVisible = () => this.visible;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };
  set(visible: boolean) {
    this.visible = visible;
    this.listeners.forEach((listener) => listener());
  }
}

const START = Date.parse("2026-10-05T06:20:45Z");

let visibility: FakeVisibility;
let fetcher: ReturnType<typeof vi.fn>;
let onData: ReturnType<typeof vi.fn>;
let onError: ReturnType<typeof vi.fn>;

function poller() {
  return new LivePoller<string>({ load: fetcher as never, onData: onData as never, onError: onError as never, visibility, now: () => Date.now() });
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(START);
  visibility = new FakeVisibility();
  fetcher = vi.fn(async () => "data");
  onData = vi.fn();
  onError = vi.fn();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("polling every 30 seconds", () => {
  it("does not fetch at start (the server rendered fresh data), then fetches every 30 s", async () => {
    const live = poller();
    live.start();
    expect(fetcher).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(29_999);
    expect(fetcher).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(fetcher).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(30_000);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(onData).toHaveBeenCalledWith("data");
    live.stop();
  });

  it("stops polling when stopped", async () => {
    const live = poller();
    live.start();
    live.stop();
    await vi.advanceTimersByTimeAsync(120_000);
    expect(fetcher).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe("tab visibility", () => {
  it("does not poll while the tab is hidden", async () => {
    const live = poller();
    live.start();
    visibility.set(false);
    await vi.advanceTimersByTimeAsync(5 * 60_000);
    expect(fetcher).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
    live.stop();
  });

  it("refetches at once when the tab becomes visible, then resumes the 30 s rhythm", async () => {
    const live = poller();
    live.start();
    visibility.set(false);
    await vi.advanceTimersByTimeAsync(10 * 60_000);
    visibility.set(true);
    await vi.advanceTimersByTimeAsync(0);
    expect(fetcher).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(30_000);
    expect(fetcher).toHaveBeenCalledTimes(2);
    live.stop();
  });

  it("starts hidden without polling and refetches when first shown", async () => {
    visibility.visible = false;
    const live = poller();
    live.start();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(fetcher).not.toHaveBeenCalled();
    visibility.set(true);
    await vi.advanceTimersByTimeAsync(0);
    expect(fetcher).toHaveBeenCalledTimes(1);
    live.stop();
  });
});

describe("one request at a time", () => {
  it("skips a tick while a request is still in flight", async () => {
    let release: (value: string) => void = () => {};
    fetcher.mockImplementation(() => new Promise<string>((resolve) => (release = resolve)));
    const live = poller();
    live.start();
    await vi.advanceTimersByTimeAsync(30_000);
    expect(fetcher).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(90_000); // three more intervals pass, still waiting
    expect(fetcher).toHaveBeenCalledTimes(1);
    release("late");
    await vi.advanceTimersByTimeAsync(0);
    expect(onData).toHaveBeenCalledWith("late");
    await vi.advanceTimersByTimeAsync(30_000);
    expect(fetcher).toHaveBeenCalledTimes(2);
    live.stop();
  });

  it("does not start a second request when refreshed while one is in flight", async () => {
    fetcher.mockImplementation(() => new Promise(() => {}));
    const live = poller();
    live.start();
    live.refresh();
    live.refresh();
    expect(fetcher).toHaveBeenCalledTimes(1);
    live.stop();
  });
});

describe("failures", () => {
  it("backs off 30 -> 60 -> 120 s, stays at 120 s, and resets on success", async () => {
    fetcher.mockRejectedValue(new Error("down"));
    const live = poller();
    live.start();
    const calls: number[] = [];
    fetcher.mockImplementation(async () => {
      calls.push(Date.now() - START);
      throw new Error("down");
    });
    await vi.advanceTimersByTimeAsync(30_000 + 60_000 + 120_000 + 120_000 + 1);
    expect(calls).toEqual([30_000, 90_000, 210_000, 330_000]);

    fetcher.mockImplementation(async () => {
      calls.push(Date.now() - START);
      return "ok";
    });
    await vi.advanceTimersByTimeAsync(120_000);
    expect(calls.at(-1)).toBe(450_000);
    await vi.advanceTimersByTimeAsync(30_000); // reset: the next one is 30 s later
    expect(calls.at(-1)).toBe(480_000);
    live.stop();
  });

  it("keeps the last good data: a failure never calls onData and reports the error", async () => {
    const live = poller();
    live.start();
    await vi.advanceTimersByTimeAsync(30_000);
    expect(onData).toHaveBeenCalledTimes(1);
    fetcher.mockRejectedValueOnce(new Error("down"));
    await vi.advanceTimersByTimeAsync(30_000);
    expect(onData).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledTimes(1);
    expect(live.getStatus().failing).toBe(true);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(live.getStatus().failing).toBe(false);
    live.stop();
  });

  it("does not report an aborted request (stop, unmount) as a failure", async () => {
    fetcher.mockImplementation((signal: AbortSignal) => new Promise((_, reject) => signal.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")))));
    const live = poller();
    live.start();
    await vi.advanceTimersByTimeAsync(30_000);
    live.stop();
    await vi.advanceTimersByTimeAsync(0);
    expect(onError).not.toHaveBeenCalled();
  });
});

describe("status for the Live pill", () => {
  it("records the time of the last success, starting with the server-rendered data", async () => {
    const live = poller();
    live.start();
    expect(live.getStatus()).toEqual({ lastSuccessAt: START, failing: false });
    await vi.advanceTimersByTimeAsync(30_000);
    expect(live.getStatus().lastSuccessAt).toBe(START + 30_000);
    live.stop();
  });

  it("tells subscribers when the status changes", async () => {
    const live = poller();
    const listener = vi.fn();
    live.subscribe(listener);
    live.start();
    await vi.advanceTimersByTimeAsync(30_000);
    expect(listener).toHaveBeenCalled();
    live.stop();
  });
});

describe("formatUpdatedAgo", () => {
  it.each([
    [0, "updated just now"],
    [4_999, "updated just now"],
    [5_000, "updated 5 s ago"],
    [20_000, "updated 20 s ago"],
    [59_999, "updated 59 s ago"],
    [60_000, "updated 1 min ago"],
    [125_000, "updated 2 min ago"],
    [3_600_000, "updated 60 min ago"],
    [-3_000, "updated just now"],
  ])("%i ms after the last update: %s", (age, text) => {
    expect(formatUpdatedAgo(age)).toBe(text);
  });
});
