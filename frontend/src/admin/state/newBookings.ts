// New-booking notifications (FR-042). A staff session learns of bookings from the Overview's
// `recentBookings`, polled every 30 s on the Overview and on Bookings; the demo's simulated bookings are
// announced directly. The first answer only records the newest `bookedAt` (a page that was just opened
// does not announce what was already there); every later answer announces each newer booking once.
// At most three notifications are visible, each hides itself after 8 s unless it is hovered or has focus.
// Time and timers are injected so tests drive them.
import type { RecentBooking } from "@/admin/lib/schemas";

export const TOAST_MS = 8000;
export const MAX_VISIBLE = 3;

export type HoldReason = "hover" | "focus";

export type NewBookingToast = {
  /** The booking's reference: one notification per booking. */
  id: string;
  booking: RecentBooking;
  /** Milliseconds left before it hides by itself. */
  remainingMs: number;
  held: boolean;
};

type Timers = {
  setTimeout: (callback: () => void, ms: number) => ReturnType<typeof setTimeout>;
  clearTimeout: (handle: ReturnType<typeof setTimeout>) => void;
};

type Listener = () => void;

type Entry = { toast: NewBookingToast; timer: ReturnType<typeof setTimeout> | null; startedAt: number; reasons: Set<HoldReason> };

export class NewBookingsStore {
  private seeded = false;
  private newest = Number.NEGATIVE_INFINITY;
  private entries: Entry[] = [];
  private view: readonly NewBookingToast[] = [];
  private snapshot = 0;
  private readonly listeners = new Set<Listener>();

  constructor(
    private readonly now: () => number = Date.now,
    private readonly timers: Timers = { setTimeout: (callback, ms) => setTimeout(callback, ms), clearTimeout: (handle) => clearTimeout(handle) },
  ) {}

  /** True once an answer has been seen, so a screen knows whether it still has to learn the baseline. */
  isSeeded(): boolean {
    return this.seeded;
  }

  /**
   * Takes the `recentBookings` of an Overview answer. The first call only records the newest `bookedAt`.
   * Later calls announce each booking newer than that, oldest first, and return the ones announced.
   */
  ingest(items: readonly RecentBooking[]): RecentBooking[] {
    if (!this.seeded) {
      this.seeded = true;
      this.newest = items.reduce((latest, item) => Math.max(latest, Date.parse(item.bookedAt)), Number.NEGATIVE_INFINITY);
      return [];
    }
    const fresh = items.filter((item) => Date.parse(item.bookedAt) > this.newest).sort((a, b) => a.bookedAt.localeCompare(b.bookedAt));
    for (const item of fresh) {
      this.newest = Math.max(this.newest, Date.parse(item.bookedAt));
      this.show(item);
    }
    return fresh;
  }

  /** Shows a notification for a booking that did not come from the server (the demo's simulated ones). */
  announce(booking: RecentBooking): void {
    this.seeded = true;
    this.show(booking);
  }

  toasts(): readonly NewBookingToast[] {
    return this.view;
  }

  /** Hovering or focusing a notification stops its countdown; leaving or blurring resumes it. */
  hold(id: string, reason: HoldReason): void {
    const entry = this.find(id);
    if (!entry || entry.reasons.has(reason)) return;
    entry.reasons.add(reason);
    if (entry.timer !== null) {
      this.timers.clearTimeout(entry.timer);
      entry.timer = null;
      entry.toast = { ...entry.toast, remainingMs: Math.max(0, entry.toast.remainingMs - (this.now() - entry.startedAt)), held: true };
    }
    this.emit();
  }

  release(id: string, reason: HoldReason): void {
    const entry = this.find(id);
    if (!entry || !entry.reasons.delete(reason)) return;
    if (entry.reasons.size === 0) {
      entry.toast = { ...entry.toast, held: false };
      this.start(entry);
    }
    this.emit();
  }

  dismiss(id: string): void {
    const entry = this.find(id);
    if (!entry) return;
    if (entry.timer !== null) this.timers.clearTimeout(entry.timer);
    this.entries = this.entries.filter((e) => e !== entry);
    this.emit();
  }

  /** For `useSyncExternalStore`. */
  getSnapshot = (): number => this.snapshot;

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  reset(): void {
    for (const entry of this.entries) if (entry.timer !== null) this.timers.clearTimeout(entry.timer);
    this.entries = [];
    this.seeded = false;
    this.newest = Number.NEGATIVE_INFINITY;
    this.emit();
  }

  private find(id: string): Entry | undefined {
    return this.entries.find((entry) => entry.toast.id === id);
  }

  private show(booking: RecentBooking): void {
    if (this.find(booking.reference)) return;
    const entry: Entry = { toast: { id: booking.reference, booking, remainingMs: TOAST_MS, held: false }, timer: null, startedAt: this.now(), reasons: new Set() };
    this.entries.push(entry);
    while (this.entries.length > MAX_VISIBLE) {
      const oldest = this.entries.shift();
      if (oldest?.timer != null) this.timers.clearTimeout(oldest.timer);
    }
    this.start(entry);
    this.emit();
  }

  private start(entry: Entry): void {
    entry.startedAt = this.now();
    entry.timer = this.timers.setTimeout(() => this.dismiss(entry.toast.id), entry.toast.remainingMs);
  }

  private emit(): void {
    this.view = this.entries.map((entry) => entry.toast);
    this.snapshot += 1;
    for (const listener of [...this.listeners]) listener();
  }
}

/** Shared by the Overview and Bookings, so a notification survives a change of screen. */
export const newBookings = new NewBookingsStore();
