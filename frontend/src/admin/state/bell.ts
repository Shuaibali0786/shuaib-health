// The bell (Feature 012): how many bookings are new for the signed-in staff member, and the newest few.
// One store and one poller (30 s while the tab is visible) serve every place that shows it. The server is the
// source of truth for a staff member; the demo keeps what it has opened in memory (no browser storage: the
// guards forbid it, and a reload simply shows the sample as new again), because the demo server is read-only.
// `cutoff` hides, until the next answer, what "Mark all seen" has just cleared.
//
// Rendering reads the bell only through `useBell()`, never the store directly. The shell (and its bell poll) hydrates
// before a page that streams in later, so by the time that page hydrates the store may already hold an answer the
// server never saw. `useBell()` hands React the empty server state while it hydrates, then the live one (React's
// `getServerSnapshot` contract), so the first client render always matches the server's HTML.
import { useSyncExternalStore } from "react";

import { adminRequest } from "@/admin/lib/client";
import { NewBookingsSchema, type BookingSummary, type NewBookings } from "@/admin/lib/schemas";

import { LivePoller } from "./livePoll";

type Listener = () => void;

/** What renders from the bell: an immutable snapshot, replaced (never mutated) on every change. */
export type BellState = {
  /** What the bell shows, or null before the first answer. */
  view: NewBookings | null;
  opened: ReadonlySet<string>;
  cutoff: number;
};

/** The state the server renders with (it never polls), and the one React hydrates with. */
export const EMPTY_BELL: BellState = Object.freeze({ view: null, opened: new Set<string>(), cutoff: Number.NEGATIVE_INFINITY });

/** Whether a row the server called new is still new in this state. */
export function isNewIn(state: BellState, booking: Pick<BookingSummary, "reference" | "isNew" | "bookedAt">): boolean {
  return booking.isNew === true && !state.opened.has(booking.reference) && Date.parse(booking.bookedAt) > state.cutoff;
}

export class BellStore {
  private data: NewBookings | null = null;
  private opened = new Set<string>();
  private cutoff = Number.NEGATIVE_INFINITY;
  private demo = false;
  private state: BellState = EMPTY_BELL;
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

  /** For event handlers (not rendering): whether a row is still new right now. */
  isNew(booking: Pick<BookingSummary, "reference" | "isNew" | "bookedAt">): boolean {
    return isNewIn(this.state, booking);
  }

  /** For event handlers and tests (not rendering): what the bell shows right now. */
  current(): NewBookings | null {
    return this.state.view;
  }

  /** For `useSyncExternalStore`: the same object until something changes. */
  getState = (): BellState => this.state;

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
    this.opened.clear();
    this.cutoff = Number.NEGATIVE_INFINITY;
    this.demo = false;
    this.state = EMPTY_BELL;
    this.notify();
  }

  private compute(): NewBookings | null {
    if (!this.data) return null;
    if (Number.isFinite(this.cutoff)) return { count: 0, items: [] };
    const items = this.data.items.filter((item) => !this.opened.has(item.reference));
    return { count: Math.max(0, this.data.count - this.opened.size), items };
  }

  private emit(): void {
    this.state = { view: this.compute(), opened: new Set(this.opened), cutoff: this.cutoff };
    this.notify();
  }

  private notify(): void {
    for (const listener of [...this.listeners]) listener();
  }
}

export const bell = new BellStore();

const serverState = (): BellState => EMPTY_BELL;

/** The bell for rendering: the empty server state during hydration, the live state after (see the top of this file). */
export function useBell(): BellState {
  return useSyncExternalStore(bell.subscribe, bell.getState, serverState);
}
