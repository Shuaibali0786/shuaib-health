// Live updates by polling (research R19): the screens re-fetch their data every 30 s while the tab is
// visible, immediately when it becomes visible, one request at a time, backing off 30 -> 60 -> 120 s
// after failures. The last good data stays on screen, because the poller only ever hands over data it
// received successfully. Time and visibility are injected so tests drive them.

export const POLL_INTERVAL_MS = 30_000;
export const MAX_BACKOFF_MS = 120_000;

export type Visibility = {
  isVisible(): boolean;
  /** Calls `listener` on every visibility change. Returns the unsubscribe function. */
  subscribe(listener: () => void): () => void;
};

export type LivePollStatus = { lastSuccessAt: number; failing: boolean };

export type LivePollOptions<T> = {
  load: (signal: AbortSignal) => Promise<T>;
  onData: (data: T) => void;
  onError?: (error: unknown) => void;
  intervalMs?: number;
  visibility?: Visibility;
  now?: () => number;
};

export const documentVisibility: Visibility = {
  isVisible: () => typeof document === "undefined" || document.visibilityState === "visible",
  subscribe: (listener) => {
    document.addEventListener("visibilitychange", listener);
    return () => document.removeEventListener("visibilitychange", listener);
  },
};

const isAbort = (error: unknown) => error instanceof DOMException && error.name === "AbortError";

export class LivePoller<T> {
  private readonly options: LivePollOptions<T>;
  private readonly visibility: Visibility;
  private readonly now: () => number;
  private readonly interval: number;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private controller: AbortController | null = null;
  private stopVisibility: (() => void) | null = null;
  private failures = 0;
  private running = false;
  private status: LivePollStatus;
  private readonly listeners = new Set<() => void>();

  constructor(options: LivePollOptions<T>) {
    this.options = options;
    this.visibility = options.visibility ?? documentVisibility;
    this.now = options.now ?? Date.now;
    this.interval = options.intervalMs ?? POLL_INTERVAL_MS;
    this.status = { lastSuccessAt: this.now(), failing: false };
  }

  /** Begins polling. The data on screen is taken to be fresh now (it was rendered by the server). */
  start(): void {
    if (this.running) return;
    this.running = true;
    this.status = { lastSuccessAt: this.now(), failing: false };
    this.stopVisibility = this.visibility.subscribe(() => this.onVisibilityChange());
    if (this.visibility.isVisible()) this.schedule(this.interval);
    else this.emit();
  }

  stop(): void {
    this.running = false;
    this.clearTimer();
    this.controller?.abort();
    this.controller = null;
    this.stopVisibility?.();
    this.stopVisibility = null;
  }

  /** Fetches now, unless a request is already in flight. */
  refresh(): void {
    if (!this.running || this.controller) return;
    this.clearTimer();
    void this.run();
  }

  getStatus(): LivePollStatus {
    return this.status;
  }

  /** For `useSyncExternalStore`: called when the status changes. */
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  private onVisibilityChange(): void {
    if (!this.running) return;
    if (this.visibility.isVisible()) this.refresh();
    else this.clearTimer();
  }

  private schedule(delay: number): void {
    this.clearTimer();
    if (!this.running || !this.visibility.isVisible()) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      if (this.controller) {
        // A request is still running: skip this tick and wait one interval again.
        this.schedule(this.interval);
        return;
      }
      void this.run();
    }, delay);
  }

  private clearTimer(): void {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
  }

  private async run(): Promise<void> {
    const controller = new AbortController();
    this.controller = controller;
    try {
      const data = await this.options.load(controller.signal);
      if (controller.signal.aborted) return;
      this.failures = 0;
      this.status = { lastSuccessAt: this.now(), failing: false };
      this.options.onData(data);
    } catch (error) {
      if (controller.signal.aborted || isAbort(error)) return;
      this.failures += 1;
      this.status = { ...this.status, failing: true };
      this.options.onError?.(error);
    } finally {
      if (this.controller === controller) this.controller = null;
    }
    this.emit();
    this.schedule(Math.min(this.interval * 2 ** this.failures, MAX_BACKOFF_MS));
  }

  private emit(): void {
    this.listeners.forEach((listener) => listener());
  }
}

/** "updated just now", "updated 20 s ago", "updated 2 min ago" for the Live pill. */
export function formatUpdatedAgo(ageMs: number): string {
  const seconds = Math.floor(Math.max(0, ageMs) / 1000);
  if (seconds < 5) return "updated just now";
  if (seconds < 60) return `updated ${seconds} s ago`;
  return `updated ${Math.floor(seconds / 60)} min ago`;
}
