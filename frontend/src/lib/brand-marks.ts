/**
 * The Booking Plus mark: a calendar body with two gold binder rings and a teal plus, drawn on a
 * 64 x 64 grid. Two drawings share one idea: the default mark for sizes above 32 px, and a sturdier
 * SMALL drawing (heavier rings and plus, wider body) for 32 px and below, including the favicon.
 *
 * Used by LogoMark.tsx; app/icon.svg and app/apple-icon.tsx repeat the same shapes because they are
 * standalone files. The colours repeat the --color-brand-* tokens in tokens.css (standalone SVG and
 * PDF output cannot read CSS variables); tests/unit/tokens.test.ts and logo.test.tsx keep them in sync.
 */

export const MARK_VIEWBOX = 64;

export type MarkPart = "body" | "rings" | "plus";
export interface MarkRect {
  part: MarkPart;
  x: number;
  y: number;
  width: number;
  height: number;
  rx: number;
}

/** Default mark, for sizes above 32 px. */
export const MARK_LARGE: readonly MarkRect[] = [
  { part: "body", x: 7, y: 12, width: 50, height: 46, rx: 12 },
  { part: "rings", x: 18.5, y: 5, width: 6, height: 14, rx: 3 },
  { part: "rings", x: 39.5, y: 5, width: 6, height: 14, rx: 3 },
  { part: "plus", x: 28, y: 23, width: 8, height: 26, rx: 2.5 },
  { part: "plus", x: 19, y: 32, width: 26, height: 8, rx: 2.5 },
];

/** Small mark, for 32 px and below. */
export const MARK_SMALL: readonly MarkRect[] = [
  { part: "body", x: 4, y: 10, width: 56, height: 51, rx: 12 },
  { part: "rings", x: 15, y: 2, width: 10, height: 15, rx: 4 },
  { part: "rings", x: 39, y: 2, width: 10, height: 15, rx: 4 },
  { part: "plus", x: 26, y: 20, width: 12, height: 33, rx: 2 },
  { part: "plus", x: 15, y: 30.5, width: 34, height: 12, rx: 2 },
];

/** Marks of this size and smaller use the SMALL drawing. */
export const SMALL_MARK_MAX_PX = 32;

export type MarkTone = "light" | "night" | "one-colour";

/** Fill of each part. The one-colour mark is for print: body and rings in navy, the plus knocked out in white. */
export const MARK_COLOURS: Record<MarkTone, Record<MarkPart, string>> = {
  light: { body: "#0B1F3A", rings: "#C9A24A", plus: "#2BB5A8" },
  night: { body: "#F7F5EF", rings: "#C9A24A", plus: "#1E8F84" },
  "one-colour": { body: "#0B1F3A", rings: "#0B1F3A", plus: "#FFFFFF" },
};

/**
 * The faint mark behind the appointment slip: the rings take the body's colour (no gold), so it can
 * never compete with the text above it. Drawn at 2 % opacity on the page and the PDF.
 */
export const WATERMARK_COLOURS: Record<MarkPart, string> = { body: "#0B1F3A", rings: "#0B1F3A", plus: "#2BB5A8" };

/** Colours of the two wordmark words. */
export const WORDMARK_COLOURS: Record<MarkTone, { shuaib: string; health: string }> = {
  light: { shuaib: "#0B1F3A", health: "#1E7F76" },
  night: { shuaib: "#FFFFFF", health: "#5FD0C5" },
  "one-colour": { shuaib: "#0B1F3A", health: "#0B1F3A" },
};
