import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { UNDO_WINDOW_MS, UndoStore } from "@/admin/state/undo";

let clock = 0;
beforeEach(() => {
  vi.useFakeTimers();
  clock = 1_000_000;
});
afterEach(() => vi.useRealTimers());

const store = () => new UndoStore(() => clock);
const advance = (ms: number) => {
  clock += ms;
  vi.advanceTimersByTime(ms);
};

describe("UndoStore", () => {
  it("offers an undo for ten seconds and then withdraws it", () => {
    const undo = store();
    undo.offerUndo({ reference: "R1", message: "Marked A. as arrived.", run: vi.fn() });
    expect(undo.current()?.expiresAt).toBe(clock + UNDO_WINDOW_MS);
    expect(undo.secondsLeft()).toBe(10);
    advance(7_000);
    expect(undo.secondsLeft()).toBe(3);
    advance(3_000);
    expect(undo.current()).toBeNull();
  });

  it("runs the undo once, even when clicked twice", async () => {
    const undo = store();
    const run = vi.fn();
    undo.offerUndo({ reference: "R1", message: "m", run });
    expect(await undo.undo()).toBe(true);
    expect(await undo.undo()).toBe(false);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("a newer change replaces the offer, because only the latest change can be undone", async () => {
    const undo = store();
    const first = vi.fn();
    const second = vi.fn();
    undo.offerUndo({ reference: "R1", message: "one", run: first });
    advance(4_000);
    undo.offerUndo({ reference: "R2", message: "two", run: second });
    expect(undo.current()?.reference).toBe("R2");
    await undo.undo();
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it("refuses an undo after the window, without running it", async () => {
    const undo = store();
    const run = vi.fn();
    undo.offerUndo({ reference: "R1", message: "m", run });
    clock += UNDO_WINDOW_MS + 1; // the timer has not fired yet, the clock has passed
    expect(await undo.undo()).toBe(false);
    expect(run).not.toHaveBeenCalled();
  });

  it("tells subscribers when the offer starts and ends", () => {
    const undo = store();
    const listener = vi.fn();
    undo.subscribe(listener);
    undo.offerUndo({ reference: "R1", message: "m", run: vi.fn() });
    advance(UNDO_WINDOW_MS);
    expect(listener).toHaveBeenCalledTimes(2);
  });
});
