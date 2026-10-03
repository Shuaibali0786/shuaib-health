/**
 * Shared forbidden-content patterns for the honesty checks (constitution I). Whole-word matches,
 * so "reviewing a folder" or the CSS class "leading-none" do not trip them.
 */

/** Claims the demo must never make. */
export const BANNED_CLAIMS =
  /\b(ratings?|reviews?|testimonials?|awards?|award-winning|certified|certifications?|accredited|accreditations?|patients served|years of experience|best in|number one|top-rated|jci|iso 9001|iso-certified|pmdc|registration numbers?)\b/i;

/** Brands and real institutions that must not appear anywhere. */
export const BRAND_WORDS =
  /\b(apollo|aga khan|agha khan|shifa|mayo clinic|cleveland clinic|johns hopkins|dow university|liaquat|shaukat khanum|indus hospital|ziauddin|jinnah hospital|civil hospital|harvard|oxford|cambridge|jci|iso 9001|google|facebook|whatsapp|pexels|unsplash|shutterstock)\b/i;

/** Every string value inside nested data. */
export function stringValues(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(stringValues);
  if (value && typeof value === "object") return Object.values(value).flatMap(stringValues);
  return [];
}
