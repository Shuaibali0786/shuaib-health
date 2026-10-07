"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { clinicClock } from "./clinicClock";
import { LivePoller, type LivePollOptions, type LivePollStatus } from "./livePoll";

type LiveStatusValue = {
  /** The newest status any screen poller reported; null until a screen starts polling. */
  status: LivePollStatus | null;
  report: (status: LivePollStatus | null) => void;
};

const LiveStatusContext = createContext<LiveStatusValue>({ status: null, report: () => {} });

/** Lets the status bar show when the screen last refreshed, without the screen knowing about the bar. */
export function LiveStatusProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<LivePollStatus | null>(null);
  const report = useCallback((next: LivePollStatus | null) => setStatus(next), []);
  const value = useMemo(() => ({ status, report }), [status, report]);
  return <LiveStatusContext.Provider value={value}>{children}</LiveStatusContext.Provider>;
}

export function useLiveStatus(): LivePollStatus | null {
  return useContext(LiveStatusContext).status;
}

/**
 * Polls `load` every 30 s while the tab is visible (see livePoll.ts) and reports the result to the
 * status bar. `onData` receives only successful answers, so the screen keeps its last good data when a
 * refresh fails. Returns `refresh` for a Retry button.
 */
export function useLivePoll<T>(options: Pick<LivePollOptions<T>, "load" | "onData" | "onError" | "intervalMs">): { refresh: () => void } {
  const { report } = useContext(LiveStatusContext);
  const { load: loader, onData, onError, intervalMs } = options;
  const poller = useRef<LivePoller<T> | null>(null);

  useEffect(() => {
    // "Updated N ago" is measured on the clinic clock, the same one the header clock shows.
    const next = new LivePoller<T>({ load: loader, onData, onError, intervalMs, now: () => clinicClock.now() });
    const stopListening = next.subscribe(() => report(next.getStatus()));
    next.start();
    report(next.getStatus());
    poller.current = next;
    return () => {
      stopListening();
      next.stop();
      poller.current = null;
      report(null);
    };
  }, [loader, onData, onError, intervalMs, report]);

  return { refresh: useCallback(() => poller.current?.refresh(), []) };
}
