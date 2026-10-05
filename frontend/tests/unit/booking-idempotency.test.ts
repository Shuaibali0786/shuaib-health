import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { attemptFingerprint, createAttemptKey, useAttemptKey } from "@/lib/booking/idempotency";

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe("createAttemptKey", () => {
  it("makes a UUID v4 each time", () => {
    const first = createAttemptKey();
    expect(first).toMatch(UUID_V4);
    expect(createAttemptKey()).not.toBe(first);
  });
});

describe("useAttemptKey", () => {
  const same = attemptFingerprint(["dr-omar-sheikh", "2026-10-06T09:00:00Z", "Ayesha Khan", "03001234567", null, "Checkup"]);

  it("keeps one key while the slot and details are unchanged (a retry or double click)", () => {
    const { result } = renderHook(() => useAttemptKey());
    const first = result.current.keyFor(same);
    expect(first).toMatch(UUID_V4);
    expect(result.current.keyFor(same)).toBe(first);
  });

  it("keeps the key across re-renders", () => {
    const { result, rerender } = renderHook(() => useAttemptKey());
    const first = result.current.keyFor(same);
    rerender();
    expect(result.current.keyFor(same)).toBe(first);
  });

  it("starts a new key when the slot changes", () => {
    const { result } = renderHook(() => useAttemptKey());
    const first = result.current.keyFor(same);
    const otherSlot = attemptFingerprint(["dr-omar-sheikh", "2026-10-06T09:15:00Z", "Ayesha Khan", "03001234567", null, "Checkup"]);
    expect(result.current.keyFor(otherSlot)).not.toBe(first);
  });

  it("starts a new key when any detail changes", () => {
    const { result } = renderHook(() => useAttemptKey());
    const first = result.current.keyFor(same);
    const otherReason = attemptFingerprint(["dr-omar-sheikh", "2026-10-06T09:00:00Z", "Ayesha Khan", "03001234567", null, "Other"]);
    expect(result.current.keyFor(otherReason)).not.toBe(first);
  });

  it("starts a new key after a success", () => {
    const { result } = renderHook(() => useAttemptKey());
    const first = result.current.keyFor(same);
    result.current.reset();
    expect(result.current.keyFor(same)).not.toBe(first);
  });
});

describe("attemptFingerprint", () => {
  it("tells apart values that would collide if joined with a separator", () => {
    expect(attemptFingerprint(["a|b", "c"])).not.toBe(attemptFingerprint(["a", "b|c"]));
  });
});
