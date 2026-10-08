// The Undo offer that follows a status change (FR-025): one toast at a time, for ten seconds, once.
// A newer change replaces the offer, because only the latest change of a booking can be undone. The
// store knows nothing about how an undo is carried out: the screen hands in `run` (a server call for
// staff, the demo overlay for the demo). Time is injected so tests drive it.

export const UNDO_WINDOW_MS = 10_000;

export type UndoOffer = {
  reference: string;
  /** "Marked Ayesha K. as arrived." The screen writes the sentence. */
  message: string;
  /** Clinic-clock milliseconds when the offer ends. */
  expiresAt: number;
  run: () => void | Promise<void>;
};

type Listener = () => void;

export class UndoStore {
  private offer: UndoOffer | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private snapshot = 0;
  private readonly listeners = new Set<Listener>();

  constructor(private readonly now: () => number = Date.now) {}

  /** Starts (or replaces) the offer. It ends by itself after ten seconds. */
  offerUndo(input: Omit<UndoOffer, "expiresAt">): UndoOffer {
    this.clearTimer();
    this.offer = { ...input, expiresAt: this.now() + UNDO_WINDOW_MS };
    this.timer = setTimeout(() => this.dismiss(), UNDO_WINDOW_MS);
    this.emit();
    return this.offer;
  }

  current(): UndoOffer | null {
    return this.offer;
  }

  /** Whole seconds left, never below 0, for the ring. */
  secondsLeft(): number {
    return this.offer ? Math.max(0, Math.ceil((this.offer.expiresAt - this.now()) / 1000)) : 0;
  }

  /** Runs the undo once. The offer is gone before the call, so a double click cannot undo twice. */
  async undo(): Promise<boolean> {
    const offer = this.offer;
    if (!offer || this.now() > offer.expiresAt) {
      this.dismiss();
      return false;
    }
    this.dismiss();
    await offer.run();
    return true;
  }

  dismiss(): void {
    this.clearTimer();
    if (this.offer === null) return;
    this.offer = null;
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

  private clearTimer(): void {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
  }

  private emit(): void {
    this.snapshot += 1;
    for (const listener of [...this.listeners]) listener();
  }
}

/** Shared by the Bookings screen and (later) the Overview, so an offer survives a change of screen. */
export const undoStore = new UndoStore();
