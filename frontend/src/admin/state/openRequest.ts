// A request to open one booking in the Bookings drawer, from anywhere (the bell). The bell is in the shell, the
// drawer is in the Bookings screen; this tiny store joins them. A request made before the screen has mounted
// waits here until the screen takes it.
import type { BookingSummary } from "@/admin/lib/schemas";

type Listener = (booking: BookingSummary) => void;

let pending: BookingSummary | null = null;
const listeners = new Set<Listener>();

export const openRequest = {
  request(booking: BookingSummary): void {
    if (listeners.size === 0) {
      pending = booking;
      return;
    }
    for (const listener of [...listeners]) listener(booking);
  },
  /** Takes the booking waiting for a screen, if any. */
  take(): BookingSummary | null {
    const waiting = pending;
    pending = null;
    return waiting;
  },
  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  reset(): void {
    pending = null;
    listeners.clear();
  },
};
