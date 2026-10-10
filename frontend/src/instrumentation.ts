import { PHASE_PRODUCTION_BUILD } from "next/constants";

const MESSAGE = "BOOKING_PROXY_SECRET is required (at least 32 characters); refusing to start";

// Runs once when the server starts. Booking cannot work without the shared secret, so a
// production server refuses to start without it (development only logs). The build does not need it.
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.NEXT_PHASE === PHASE_PRODUCTION_BUILD) return;
  // Error reporting starts first, so even the missing-secret failure below can be reported.
  if (process.env.SENTRY_DSN?.trim()) {
    const { initServerSentry } = await import("../sentry.server.config");
    initServerSentry();
  }
  const { getProxySecret } = await import("@/lib/api/config");
  if (getProxySecret() !== null) return;
  if (process.env.NODE_ENV === "production") throw new Error(MESSAGE);
  console.error(MESSAGE);
}

// Errors thrown while rendering a page or running a route handler. Loaded lazily and only when
// reporting is on, so a site without SENTRY_DSN never touches the SDK.
export async function onRequestError(...args: unknown[]): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs" || !process.env.SENTRY_DSN?.trim()) return;
  const { captureRequestError } = await import("@sentry/nextjs");
  (captureRequestError as (...a: unknown[]) => void)(...args);
}
