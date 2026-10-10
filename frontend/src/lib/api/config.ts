import "server-only";

import { ClinicSettingsSchema, type ClinicSettings } from "./schemas";

// The only module that reads the API environment variables. All three are read at call time, so
// tests can change them. None of them is NEXT_PUBLIC_*: the browser never sees them.

/** Validated `http(s)` origin of the catalog API without a trailing slash, or null when unset or invalid. */
export function getApiBase(): string | null {
  const raw = process.env.CATALOG_API_URL?.trim();
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("scheme");
    return url.origin;
  } catch {
    console.warn("CATALOG_API_URL is not a valid http(s) URL; treating the catalog API as unconfigured.");
    return null;
  }
}

/** Clinic settings from `CLINIC_FALLBACK_JSON`, or null when missing or invalid (the value is never echoed). */
export function getClinicFallback(): ClinicSettings | null {
  const raw = process.env.CLINIC_FALLBACK_JSON?.trim();
  if (!raw) return null;
  try {
    const parsed = ClinicSettingsSchema.safeParse(JSON.parse(raw));
    if (parsed.success) return parsed.data;
  } catch {
    // fall through to the warning
  }
  console.warn("CLINIC_FALLBACK_JSON is not valid clinic settings JSON; ignoring it.");
  return null;
}

/** Data-cache window in seconds: 300 unless a test server sets `CATALOG_DATA_REVALIDATE_SECONDS` (1 to 3600). */
export function getDataRevalidateSeconds(): number {
  const raw = process.env.CATALOG_DATA_REVALIDATE_SECONDS?.trim();
  if (!raw) return 300;
  const value = Number(raw);
  if (Number.isInteger(value) && value >= 1 && value <= 3600) return value;
  console.warn("CATALOG_DATA_REVALIDATE_SECONDS must be an integer from 1 to 3600; using 300.");
  return 300;
}

/**
 * Headers that let this website's server through the API project's Vercel Deployment Protection on
 * Preview (`API_PROTECTION_BYPASS`, server-only, set in the Preview environment only). Empty when the
 * variable is unset, and always empty in Production. The value is never logged.
 */
export function protectionBypassHeaders(): Record<string, string> {
  const value = process.env.API_PROTECTION_BYPASS?.trim();
  if (!value || process.env.VERCEL_ENV === "production") return {};
  return { "x-vercel-protection-bypass": value };
}

const MIN_PROXY_SECRET_LENGTH = 32;

/**
 * The secret that proves a booking request comes from this website's server (`BOOKING_PROXY_SECRET`,
 * server-only, same value as the backend's). Null when missing or shorter than 32 characters. The value is never logged.
 */
export function getProxySecret(): string | null {
  const raw = process.env.BOOKING_PROXY_SECRET?.trim();
  return raw && raw.length >= MIN_PROXY_SECRET_LENGTH ? raw : null;
}
