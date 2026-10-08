// Unambiguous characters only (no 0/O, 1/l/I), so a temporary password can be read out or typed from a note.
const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789"; // 31 characters
const LENGTH = 16;
const GROUP = 4;
const UNBIASED_BELOW = 248; // the largest multiple of 31 that fits in a byte

/** `xxxx-xxxx-xxxx-xxxx`: 16 random characters (about 79 bits), 19 with the dashes. Browser/Node crypto. */
export function generateTempPassword(fill: (bytes: Uint8Array) => Uint8Array = (bytes) => crypto.getRandomValues(bytes)): string {
  const chars: string[] = [];
  while (chars.length < LENGTH) {
    for (const byte of fill(new Uint8Array(32))) {
      // Rejection sampling: a byte at or above the bound would favour the first characters.
      if (byte < UNBIASED_BELOW && chars.length < LENGTH) chars.push(ALPHABET[byte % ALPHABET.length] as string);
    }
  }
  const groups: string[] = [];
  for (let i = 0; i < LENGTH; i += GROUP) groups.push(chars.slice(i, i + GROUP).join(""));
  return groups.join("-");
}
