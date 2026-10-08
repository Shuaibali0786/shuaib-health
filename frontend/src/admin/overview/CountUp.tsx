"use client";

import { useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";

/** The first load counts up in about 0.9 s; a later change in 0.5 s. */
export const COUNT_FIRST_MS = 900;
export const COUNT_CHANGE_MS = 500;

/** Where a count that began at `from` is `elapsed` ms into `duration` ms on its way to `to` (ease-out). */
export function countValue(from: number, to: number, elapsed: number, duration: number): number {
  if (duration <= 0 || elapsed >= duration) return to;
  const k = Math.max(0, elapsed) / duration;
  return Math.round(from + (to - from) * (1 - Math.pow(1 - k, 3)));
}

const QUERY = "(prefers-reduced-motion: reduce)";

function subscribe(listener: () => void): () => void {
  const media = window.matchMedia(QUERY);
  media.addEventListener("change", listener);
  return () => media.removeEventListener("change", listener);
}

/** True when the visitor asked for less motion. The server's answer is "yes", so it renders the final value. */
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => true,
  );
}

/**
 * The number on screen while it counts to `target`. It starts at the final value (so the server's page and
 * a visitor who wants less motion see the answer at once) and, when motion is welcome, drops to 0 before
 * the first paint and counts up.
 */
export function useCountUp(target: number): number {
  const reduced = usePrefersReducedMotion();
  const [shown, setShown] = useState(target);
  const first = useRef(true);
  const current = useRef(target);

  useLayoutEffect(() => {
    // Hydration reports "reduced" (the server’s answer) before the device’s: that run must not use up the first load.
    if (reduced) {
      current.current = target;
      return;
    }
    const from = first.current ? 0 : current.current;
    const duration = first.current ? COUNT_FIRST_MS : COUNT_CHANGE_MS;
    first.current = false;
    let frame = 0;
    if (from === target) {
      current.current = target;
      frame = requestAnimationFrame(() => setShown(target));
      return () => cancelAnimationFrame(frame);
    }
    const began = performance.now();
    const step = (now: number) => {
      const value = countValue(from, target, now - began, duration);
      current.current = value;
      setShown(value);
      if (value !== target) frame = requestAnimationFrame(step);
    };
    current.current = from;
    setShown(from);
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [target, reduced]);

  // With less motion the answer is the target itself, with no state to catch up.
  return reduced ? target : shown;
}

/**
 * A number that counts up. Sighted visitors see the moving digits (hidden from assistive technology);
 * screen readers get only the final value, once.
 */
export function CountUp({ value, suffix = "" }: { value: number; suffix?: string }) {
  const shown = useCountUp(value);
  return (
    <>
      <span className="v" aria-hidden="true" data-testid="count-visual">
        {shown}
      </span>
      <span className="sr-only" data-testid="count-final">
        {value}
        {suffix}
      </span>
    </>
  );
}
