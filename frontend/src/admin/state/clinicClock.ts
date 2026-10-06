import { useSyncExternalStore } from "react";

import { clinicDate } from "@/admin/lib/format";

/**
 * The clinic clock (research R19). It tells the time in the clinic, not on the device: `seed` learns
 * the difference between the server's time and the device's once, and `now()` applies it, so a device
 * with a wrong clock or time zone never changes "now". One shared 1-second interval serves every
 * listener and runs only while somebody listens. Minute boundaries and a change of the clinic date are
 * derived from the same ticks.
 */
export class ClinicClock {
  private offset = 0;
  private snapshot = Date.now();
  private timer: ReturnType<typeof setInterval> | null = null;
  private readonly ticks = new Set<(nowMs: number) => void>();
  private readonly minutes = new Set<(nowMs: number) => void>();
  private readonly days = new Set<(date: string) => void>();
  private lastMinute = 0;
  private lastDate = "";

  /**
   * `serverNowMs` is the server's instant; `deviceNowMs` is what the device's clock showed at (about)
   * that instant. The default is "now", which is accurate to the time the page took to arrive.
   */
  seed(serverNowMs: number, deviceNowMs: number = Date.now()): void {
    this.offset = serverNowMs - deviceNowMs;
    this.snapshot = this.now();
    this.lastMinute = Math.floor(this.snapshot / 60_000);
    this.lastDate = clinicDate(this.snapshot);
  }

  now(): number {
    return Date.now() + this.offset;
  }

  /** For `useSyncExternalStore`: stable between ticks. */
  getSnapshot = (): number => this.snapshot;

  /** Calls `listener` every second with the clinic time in ms. Returns the unsubscribe function. */
  subscribe = (listener: (nowMs: number) => void): (() => void) => {
    this.ticks.add(listener);
    this.start();
    return () => {
      this.ticks.delete(listener);
      this.stopIfIdle();
    };
  };

  /** Calls `listener` whenever the clinic clock crosses a minute boundary. */
  onMinute(listener: (nowMs: number) => void): () => void {
    this.minutes.add(listener);
    this.start();
    return () => {
      this.minutes.delete(listener);
      this.stopIfIdle();
    };
  }

  /** Calls `listener` with the new `YYYY-MM-DD` when the clinic calendar date changes. */
  onNewDay(listener: (date: string) => void): () => void {
    this.days.add(listener);
    this.start();
    return () => {
      this.days.delete(listener);
      this.stopIfIdle();
    };
  }

  private start(): void {
    if (this.timer !== null) return;
    // Catch up after a pause, without announcing a minute or a day that passed while nobody listened.
    this.snapshot = this.now();
    this.lastMinute = Math.floor(this.snapshot / 60_000);
    this.lastDate = clinicDate(this.snapshot);
    this.timer = setInterval(() => this.tick(), 1000);
  }

  private stopIfIdle(): void {
    if (this.timer !== null && this.ticks.size + this.minutes.size + this.days.size === 0) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private tick(): void {
    const now = this.now();
    this.snapshot = now;
    for (const listener of [...this.ticks]) listener(now);

    const minute = Math.floor(now / 60_000);
    if (minute !== this.lastMinute) {
      this.lastMinute = minute;
      for (const listener of [...this.minutes]) listener(now);
    }
    const date = clinicDate(now);
    if (date !== this.lastDate) {
      this.lastDate = date;
      for (const listener of [...this.days]) listener(date);
    }
  }
}

/** The device clock reading at about the moment the server rendered the page, from navigation timing. */
export function deviceReference(): number {
  const now = Date.now();
  try {
    const [entry] = performance.getEntriesByType("navigation") as PerformanceNavigationTiming[];
    const at = performance.timeOrigin + (entry?.responseStart ?? Number.NaN);
    if (Number.isFinite(at) && at <= now && now - at < 5 * 60_000) return at;
  } catch {
    // Navigation timing is not available everywhere; "now" is close enough.
  }
  return now;
}

export const clinicClock = new ClinicClock();

/** The clinic time in ms, re-rendering every second. `serverNowMs` is what the server rendered. */
export function useClinicNow(serverNowMs: number): number {
  return useSyncExternalStore(clinicClock.subscribe, clinicClock.getSnapshot, () => serverNowMs);
}
