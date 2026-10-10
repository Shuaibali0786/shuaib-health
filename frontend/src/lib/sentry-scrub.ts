// Removes personal data from an error event before it leaves the server (007, US3). Pure and
// dependency-free so it is easy to test. Mirrors backend/app/observability.py.

const SENSITIVE_HEADER_PARTS = [
  "cookie",
  "auth",
  "token",
  "secret",
  "key",
  "proxy",
  "csrf",
  "session",
  "forwarded",
  "client-ip",
  "real-ip",
  "bypass",
  "x-vercel",
];
const EMAIL = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g;
// Ten characters of the booking-reference alphabet (no I, L, O, U), alone or in two groups of five.
const REFERENCE_GROUPED = /\b[0-9A-HJKMNP-TV-Z]{5}-[0-9A-HJKMNP-TV-Z]{5}\b/gi;
const REFERENCE = /\b[0-9A-HJKMNP-TV-Z]{10}\b/g;
const PHONE = /(?<!\w)\+?\d[\d\s().-]{7,}\d/g;
const URL_QUERY = /(\S+?)\?[^\s"'#]*/g;
const REQUEST_DROP = ["cookies", "data", "query_string", "env"];

export function maskText(text: string): string {
  return text
    .replace(EMAIL, "[email]")
    .replace(REFERENCE_GROUPED, "[reference]")
    .replace(REFERENCE, "[reference]")
    .replace(PHONE, "[phone]")
    .replace(URL_QUERY, "$1");
}

function isSensitiveHeader(name: string): boolean {
  const lowered = name.toLowerCase();
  return SENSITIVE_HEADER_PARTS.some((part) => lowered.includes(part));
}

function walk(value: unknown): unknown {
  if (typeof value === "string") return maskText(value);
  if (Array.isArray(value)) return value.map(walk);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, walk(item)]));
  }
  return value;
}

/** The `beforeSend` hook: returns an event that holds no personal data. */
export function scrubEvent<T extends object>(event: T): T {
  const copy = { ...event } as Record<string, unknown>;
  const request = copy.request;
  if (request && typeof request === "object") {
    const next = { ...(request as Record<string, unknown>) };
    for (const key of REQUEST_DROP) delete next[key];
    const headers = next.headers;
    if (headers && typeof headers === "object") {
      next.headers = Object.fromEntries(Object.entries(headers).filter(([name]) => !isSensitiveHeader(name)));
    }
    copy.request = next;
  }
  delete copy.user;
  delete copy.server_name;
  return walk(copy) as T;
}
