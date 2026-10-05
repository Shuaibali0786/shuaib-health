import { useState } from "react";

/** A fresh idempotency key: one per booking attempt (UUID v4). */
export function createAttemptKey(): string {
  return crypto.randomUUID();
}

/** What makes two submits "the same attempt": the same slot and the same details. Kept in memory only. */
export function attemptFingerprint(parts: readonly (string | null)[]): string {
  return JSON.stringify(parts);
}

export type AttemptKey = {
  /** The key for this attempt: reused while the fingerprint is unchanged, new when it changes. */
  keyFor: (fingerprint: string) => string;
  /** Forget the key (after a successful booking). */
  reset: () => void;
};

/**
 * Keeps one idempotency key per (slot + details) so a retry after a timeout or a double click is the
 * same attempt to the server. Changing the slot or any detail starts a new attempt with a new key.
 * The key lives in the hook's closure and is never rendered, stored or put in the URL.
 */
export function useAttemptKey(): AttemptKey {
  const [attempt] = useState<AttemptKey>(() => {
    let held: { fingerprint: string; key: string } | null = null;
    return {
      keyFor(fingerprint) {
        if (held?.fingerprint !== fingerprint) held = { fingerprint, key: createAttemptKey() };
        return held.key;
      },
      reset() {
        held = null;
      },
    };
  });
  return attempt;
}
