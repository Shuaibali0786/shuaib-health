import { PHASE_PRODUCTION_BUILD } from "next/constants";

const MESSAGE = "BOOKING_PROXY_SECRET is required (at least 32 characters); refusing to start";

// Runs once when the server starts. Booking cannot work without the shared secret, so a
// production server refuses to start without it (development only logs). The build does not need it.
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.NEXT_PHASE === PHASE_PRODUCTION_BUILD) return;
  const { getProxySecret } = await import("@/lib/api/config");
  if (getProxySecret() !== null) return;
  if (process.env.NODE_ENV === "production") throw new Error(MESSAGE);
  console.error(MESSAGE);
}
