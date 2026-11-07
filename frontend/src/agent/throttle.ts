// The v1 client-side limit (Feature 010, ADR-0013): 8 questions per rolling minute, 60 per page session.
// The local engine calls no server, so this only stops runaway loops. A remote provider MUST also be
// limited on the server (Postgres limiter, ADR-0006).

export const PER_MINUTE = 8;
export const PER_SESSION = 60;

export type ThrottleResult = { ok: true } | { ok: false; reason: "minute" | "session"; retryInMs: number };

export function createThrottle(now: () => number = Date.now, perMinute = PER_MINUTE, perSession = PER_SESSION) {
  const times: number[] = [];
  let total = 0;
  return {
    take(): ThrottleResult {
      const t = now();
      while (times.length && t - (times[0] ?? 0) >= 60_000) times.shift();
      if (total >= perSession) return { ok: false, reason: "session", retryInMs: Number.POSITIVE_INFINITY };
      if (times.length >= perMinute) return { ok: false, reason: "minute", retryInMs: 60_000 - (t - (times[0] ?? t)) };
      times.push(t);
      total += 1;
      return { ok: true };
    },
  };
}
