// How many times a failed screen retries by itself. The error boundary mounts its error screen afresh after each
// retry, so the count lives here, in the module, not in the screen. After a quiet minute it starts over.

export const AUTO_RETRIES = 2;
export const BASE_DELAY_MS = 1500;
export const FORGET_AFTER_MS = 60_000;

let count = 0;
let last = 0;

/** The wait before the next automatic retry (1.5 s, then 3 s), or null when the automatic retries are used up. */
export function nextRetry(now: number): number | null {
  if (now - last > FORGET_AFTER_MS) count = 0;
  last = now;
  if (count >= AUTO_RETRIES) return null;
  const delay = BASE_DELAY_MS * 2 ** count;
  count += 1;
  return delay;
}

/** The Retry button starts the sequence over. */
export function resetRetries(): void {
  count = 0;
  last = 0;
}
