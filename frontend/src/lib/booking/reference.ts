// A booking reference is ten Crockford base32 characters (no I, L, O or U), shown as XXXXX-XXXXX.
// The same rule as the backend: case and one dash are ignored.

const REFERENCE = /^[0-9A-HJKMNP-TV-Z]{10}$/;

/** The stored form (ten upper-case characters), or `null` when `text` is not a reference. */
export function parseReference(text: string): string | null {
  const candidate = text.replace(/[\s-]/g, "").toUpperCase();
  return REFERENCE.test(candidate) ? candidate : null;
}

/** `ABCDEFGHJK` -> `ABCDE-FGHJK`. */
export function displayReference(reference: string): string {
  return `${reference.slice(0, 5)}-${reference.slice(5)}`;
}
