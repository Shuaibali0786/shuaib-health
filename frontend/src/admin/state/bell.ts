// The bell (Feature 012): how many bookings are new for the signed-in staff member, and the newest few.
// One store and one poller (30 s while the tab is visible) serve every place that shows it. The server is the
// source of truth for a staff member; the demo keeps what it has opened in memory (no browser storage: the
// guards forbid it, and a reload simply shows the sample as new again), because the demo server is read-only. `cutoff` hides, until the next answer, what "Mark all seen" has just cleared.
import { adminRequest } from "@/admin/lib/client";
import { NewBookingsSchema, type BookingSummary, type NewBookings } from "@/admin/lib/schemas";

import { LivePoller } from "./livePoll";

type Listener = () => void;

export class BellStore {
  private data: NewBookings | null = null;
  private opened = new Set<string>();
  private cutoff = Number.NEGATIVE_INFINITY;
  private demo = false;
  private snapshot = 0;
  private view: NewBookings | null = null;
  private readonly listeners = new Set<Listener>();
  private poller: LivePoller<NewBookings> | null = null;
  private users = 0;

  /** Called by each place that shows the bell; the poller runs while at least one is mounted. */
  attach(demo: boolean): () => void {
    this.demo = demo;
    this.users += 1;
    if (this.poller === null) {
      this.poller = new LivePoller<NewBookings>({
        load: (signal) => adminRequest({ path: "bookings/new", signal }, NewBookingsSchema),
        onData: (next) => this.set(next),
      });
      this.poller.start();
      this.poller.refresh();
    }
    return () => {
      this.users -= 1;
      if (this.users <= 0) {
        this.poller?.stop();
        this.poller = null;
        this.users = 0;
      }
    };
  }

  /** Takes a fresh answer from the server (the poll, or the reply to a "seen" write). */
  set(next: NewBookings): void {
    this.data = next;
    if (!this.demo) {
      this.opened.clear();
      this.cutoff = Number.NEGATIVE_INFINITY;
    }
    this.emit();
  }

  refresh(): void {
    this.poller?.refresh();
  }

  /** A booking was opened: it is no longer new for this staff member. */
  markOpened(reference: string): void {
    this.opened.add(reference);
    this.emit();
  }

  /** "Mark all seen": everything booked up to `nowMs` stops being new. */
  markAll(nowMs: number): void {
    this.cutoff = nowMs;
    this.emit();
  }

  /**
   * Opening a booking clears its New mark for this staff member. The reply is the bell as it now stands. The demo
   * never writes (its server is read-only); it just remembers in memory. A failed write is ignored: the
   * mark comes back with the next refresh, which is the honest outcome.
   */
  async markSeen(reference: string): Promise<void> {
    this.markOpened(reference);
    if (this.demo) return;
    try {
      this.set(await adminRequest({ method: "POST", path: "bookings/seen", body: { references: [reference] } }, NewBookingsSchema));
    } catch {
      /* the next poll shows the truth */
    }
  }

  /** "Mark all seen" for this staff member only. */
  async markAllSeen(nowMs: number): Promise<void> {
    this.markAll(nowMs);
    if (this.demo) return;
    try {
      this.set(await adminRequest({ method: "POST", path: "bookings/seen", body: { all: true } }, NewBookingsSchema));
    } catch {
      /* the next poll shows the truth */
    }
  }

  /** Whether a row the server called new is still new here. */
  isNew(booking: Pick<BookingSummary, "reference" | "isNew" | "bookedAt">): boolean {
    return booking.isNew === true && !this.opened.has(booking.reference) && Date.parse(booking.bookedAt) > this.cutoff;
  }

  /** What the bell shows: the server's answer minus what has just been opened or cleared here. */
  current(): NewBookings | null {
    return this.view;
  }

  getSnapshot = (): number => this.snapshot;

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  reset(): void {
    this.poller?.stop();
    this.poller = null;
    this.users = 0;
    this.data = null;
    this.view = null;
    this.opened.clear();
    this.cutoff = Number.NEGATIVE_INFINITY;
    this.demo = false;
    this.emit();
  }

  private compute(): NewBookings | null {
    if (!this.data) return null;
    if (Number.isFinite(this.cutoff)) return { count: 0, items: [] };
    const items = this.data.items.filter((item) => !this.opened.has(item.reference));
    return { count: Math.max(0, this.data.count - this.opened.size), items };
  }

  private emit(): void {
    this.view = this.compute();
    this.snapshot += 1;
    for (const listener of [...this.listeners]) listener();
  }
}

export const bell = new BellStore();
