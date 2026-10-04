import { readFileSync } from "node:fs";

const recorded = JSON.parse(readFileSync("tests/fixtures/api/clinic.json", "utf8")) as Record<string, unknown>;

/**
 * The emergency number in the offline build's CLINIC_FALLBACK_JSON. It differs from the recorded
 * clinic and from the bundled sample on purpose, so seeing it on a page proves the fallback was used.
 */
export const FALLBACK_PHONE = { display: "+92 300 555 0100", tel: "+923005550100" } as const;

/** The full clinic settings JSON the offline "dead API" build gets as CLINIC_FALLBACK_JSON. */
export const FALLBACK_CLINIC_JSON = JSON.stringify({ ...recorded, emergencyPhone: FALLBACK_PHONE });
