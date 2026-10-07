// The fonts of the appointment slip PDF: the website's own brand fonts, embedded, so the PDF looks like the page.
// F1 is Inter Regular and F2 Inter SemiBold (body text), F3 is Plus Jakarta Sans Bold (headings). The files are
// cut down to Latin-1 by scripts/subset-slip-fonts.mjs; their glyph widths are in slip-font-metrics.json and
// drive every alignment, wrap and arc of text, so layout and drawing use the same numbers.
import metricsJson from "./slip-font-metrics.json";

export type SlipFontKey = "F1" | "F2" | "F3";

export interface SlipFontMetrics {
  file: string;
  /** The PostScript name, written as the PDF BaseFont. */
  name: string;
  unitsPerEm: number;
  ascent: number;
  descent: number;
  capHeight: number;
  bbox: [number, number, number, number];
  firstChar: number;
  /** Advance widths in 1/1000 em for the codes `firstChar` to 255. */
  widths: number[];
}

export const SLIP_FONT_METRICS = metricsJson as Record<SlipFontKey, SlipFontMetrics>;
export const SLIP_FONT_KEYS: readonly SlipFontKey[] = ["F1", "F2", "F3"];
/** The bytes of each embedded font, keyed like the metrics. */
export type SlipFonts = Record<SlipFontKey, Uint8Array>;

/** Public URL of a slip font file. */
export const slipFontUrl = (key: SlipFontKey): string => `/fonts/slip/${SLIP_FONT_METRICS[key].file}`;

/** Fetches the three font files. Called once, when the visitor asks for the PDF. */
export async function loadSlipFonts(fetcher: typeof fetch = fetch): Promise<SlipFonts> {
  const entries = await Promise.all(
    SLIP_FONT_KEYS.map(async (key) => {
      const response = await fetcher(slipFontUrl(key));
      if (!response.ok) throw new Error(`Slip font ${key} could not be loaded (${response.status})`);
      return [key, new Uint8Array(await response.arrayBuffer())] as const;
    }),
  );
  return Object.fromEntries(entries) as SlipFonts;
}

/** Windows-1252 byte for each character the standard "WinAnsiEncoding" holds beyond Latin-1. */
const WIN_ANSI_EXTRA: Record<string, number> = {
  "€": 0x80, "‚": 0x82, "ƒ": 0x83, "„": 0x84, "…": 0x85, "†": 0x86, "‡": 0x87, "ˆ": 0x88, "‰": 0x89, Š: 0x8a, "‹": 0x8b, Œ: 0x8c, Ž: 0x8e,
  "‘": 0x91, "’": 0x92, "“": 0x93, "”": 0x94, "•": 0x95, "–": 0x96, "—": 0x97, "˜": 0x98, "™": 0x99, š: 0x9a, "›": 0x9b, œ: 0x9c, ž: 0x9e, Ÿ: 0x9f,
};

/** The byte a character is written as in the PDF text, or 63 ("?") when the fonts do not hold it. */
export function winAnsiCode(char: string): number {
  const extra = WIN_ANSI_EXTRA[char];
  if (extra !== undefined) return extra;
  const code = char.codePointAt(0) ?? 63;
  return code >= 32 && code <= 255 && code !== 127 && !(code >= 0x80 && code <= 0x9f) ? code : 63;
}

/** Width of one character in 1/1000 em. */
export function glyphWidth(char: string, font: SlipFontKey): number {
  const metrics = SLIP_FONT_METRICS[font];
  return metrics.widths[winAnsiCode(char) - metrics.firstChar] ?? 0;
}

/** Width in points of `text` set in `font` at `size`, with `spacing` points added after every character. */
export function advance(text: string, font: SlipFontKey, size: number, spacing = 0): number {
  let total = 0;
  let count = 0;
  for (const char of text.normalize("NFC")) {
    total += (glyphWidth(char, font) * size) / 1000;
    count += 1;
  }
  return total + spacing * count;
}

/** Cap height in points. */
export const capHeight = (font: SlipFontKey, size: number): number => (SLIP_FONT_METRICS[font].capHeight * size) / 1000;
