/**
 * Geometry of the Shuaib Health mark, drawn on a 64 x 64 grid.
 * Used by LogoMark.tsx, app/icon.svg and app/apple-icon.tsx so every
 * rendering of the mark comes from the same shapes (tests keep them in sync).
 *
 * The mark: a rounded plus sign filled with a teal-to-navy gradient, with a
 * white heartbeat line through its centre. The line runs flat, then makes an
 * "S" in the middle, then runs flat again.
 */

export const LOGO_VIEWBOX = 64;

/** Rounded plus sign (arms 22 wide, outer corners rounded with radius 8). */
export const PLUS_PATH =
  "M29 4H35A8 8 0 0 1 43 12V21H52A8 8 0 0 1 60 29V35A8 8 0 0 1 52 43H43V52A8 8 0 0 1 35 60H29A8 8 0 0 1 21 52V43H12A8 8 0 0 1 4 35V29A8 8 0 0 1 12 21H21V12A8 8 0 0 1 29 4Z";

/** Heartbeat line: flat, an "S" through the centre, flat. Stays inside the plus arms. */
export const PULSE_PATH = "M6 32H16C21 32 22 24 31 24C38 24 39 29.5 32 32C25 34.5 26 40 33 40C42 40 43 32 48 32H58";

export const PULSE_STROKE_WIDTH = 3.5;
