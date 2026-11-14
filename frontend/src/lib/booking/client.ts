// Browser calls from the booking flow to this site's own booking routes (`/api/booking/...`).
// The browser never talks to the catalog API itself: these routes add the proxy secret and the
// visitor's address on the server (see backend.ts). This is the only browser-side `fetch` in src/.
import * as z from "zod";

import { DoctorSlotsSchema, type DoctorSlots } from "./schemas";

/** The doctor's slots. Throws when the request fails, is refused, or the answer is not the contract's shape. */
export async function fetchSlots(doctorSlug: string, signal: AbortSignal): Promise<DoctorSlots> {
  const res = await fetch(`/api/booking/slots/${encodeURIComponent(doctorSlug)}`, { cache: "no-store", signal });
  if (!res.ok) throw new Error(`slots ${res.status}`);
  return DoctorSlotsSchema.parse(await res.json());
}

/** `retryAfter` is the `Retry-After` header in whole seconds, when the server sent a usable one. */
export type BookingAnswer = { status: number; body: unknown; retryAfter: number | null };

/** Sends one booking attempt. Throws only when the network fails; every HTTP answer is returned as it is. */
export async function postBooking(payload: unknown, idempotencyKey: string): Promise<BookingAnswer> {
  const res = await fetch("/api/booking/appointments", {
    method: "POST",
    cache: "no-store",
    headers: { "Content-Type": "application/json", "Idempotency-Key": idempotencyKey },
    body: JSON.stringify(payload),
  });
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    // An empty or non-JSON body stays null; the caller treats a 2xx without a valid body as a failure.
  }
  const header = Number(res.headers.get("retry-after"));
  return { status: res.status, body, retryAfter: Number.isFinite(header) && header > 0 ? header : null };
}

// Feature 013: a short-lived token for the premium voice provider, from this site's own route (`/api/speech/token`),
// which asks our API; the provider key itself never reaches the browser.
const SpeechTokenSchema = z.object({ token: z.string().min(10), region: z.string().min(2).max(40), expiresInSeconds: z.number().int().positive() });
export type SpeechToken = z.infer<typeof SpeechTokenSchema>;

/** A speech token, or a thrown error (the caller then uses the free browser voice). */
export async function fetchSpeechToken(): Promise<SpeechToken> {
  const res = await fetch("/api/speech/token", { method: "POST", cache: "no-store", headers: { "Content-Type": "application/json" }, body: "{}" });
  if (!res.ok) throw new Error(`speech token ${res.status}`);
  return SpeechTokenSchema.parse(await res.json());
}
