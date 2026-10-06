import type { BookingStatus } from "@/admin/lib/schemas";

/**
 * What a demo visitor changes, kept in the browser's memory on top of the server's sample data (ADR-0009).
 * The demo server is strictly read-only: a status change here never leaves this module, is keyed by booking
 * reference, and is gone on reload or when the demo ends. Undo works for ten seconds, like the real one.
 * Simulated new bookings are added by the Overview story.
 */

export const UNDO_WINDOW_MS = 10_000;

export type OverlayChange = {
  reference: string;
  from: BookingStatus;
  to: BookingStatus;
  /** Clinic-clock milliseconds when the change was made. */
  at: number;
  isUndo: boolean;
};

type Listener = () => void;

export class DemoOverlay {
  private status = new Map<string, BookingStatus>();
  private changes = new Map<string, OverlayChange[]>();
  private snapshot = 0;
  private readonly listeners = new Set<Listener>();

  constructor(private readonly now: () => number = Date.now) {}

  /** Records a status change. Returns it, or null when the booking already has that status. */
  setStatus(reference: string, from: BookingStatus, to: BookingStatus): OverlayChange | null {
    if (from === to) return null;
    const change: OverlayChange = { reference, from, to, at: this.now(), isUndo: false };
    this.status.set(reference, to);
    this.changes.set(reference, [...(this.changes.get(reference) ?? []), change]);
    this.emit();
    return change;
  }

  /** The latest change of a booking can be undone for ten seconds, once; an undo cannot be undone. */
  canUndo(reference: string): boolean {
    const latest = this.changes.get(reference)?.at(-1);
    return latest !== undefined && !latest.isUndo && this.now() - latest.at <= UNDO_WINDOW_MS;
  }

  /** Restores the status before the latest change and returns it, or null when undo is not available. */
  undo(reference: string): BookingStatus | null {
    if (!this.canUndo(reference)) return null;
    const latest = this.changes.get(reference)!.at(-1)!;
    const undone: OverlayChange = { reference, from: latest.to, to: latest.from, at: this.now(), isUndo: true };
    this.status.set(reference, latest.from);
    this.changes.set(reference, [...this.changes.get(reference)!, undone]);
    this.emit();
    return latest.from;
  }

  statusOf(reference: string, serverStatus: BookingStatus): BookingStatus {
    return this.status.get(reference) ?? serverStatus;
  }

  /** The booking with the visitor's local status laid over it. The given object is not changed. */
  apply<T extends { reference: string; status: BookingStatus }>(booking: T): T {
    const local = this.status.get(booking.reference);
    return local === undefined || local === booking.status ? booking : { ...booking, status: local };
  }

  /** Oldest first, including undos, for the drawer's status history. */
  history(reference: string): readonly OverlayChange[] {
    return this.changes.get(reference) ?? [];
  }

  reset(): void {
    this.status = new Map();
    this.changes = new Map();
    this.emit();
  }

  /** For `useSyncExternalStore`: the same number until something changes. */
  getSnapshot = (): number => this.snapshot;

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  private emit(): void {
    this.snapshot += 1;
    for (const listener of [...this.listeners]) listener();
  }
}

/** The visitor's overlay, shared by every screen of the demo. */
export const demoOverlay = new DemoOverlay();
