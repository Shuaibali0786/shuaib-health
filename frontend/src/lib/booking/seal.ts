// The CONFIRMED stamp of the appointment slip, laid out once for both the page (SVG) and the PDF so the two
// are the same drawing. Units are those of a 120 x 120 box centred on (0, 0), y pointing down (screen
// coordinates); the page scales the box with CSS and the PDF with a transform.
//
//   outer ring ........ r 58
//   top arc text ...... the clinic name, between the rings, reading clockwise over the top
//   inner ring ........ r 46
//   centre ............ a check mark and CONFIRMED, tilted a little, with "BOOKED 07 OCT" beneath
//   bottom arc text ... "• DEMO •", between the rings, reading left to right along the bottom
//
// Every glyph is placed by its own measured width, so no text can touch or cross a ring: the clearance to
// both rings is part of the geometry (`SEAL.clearance`) and `sealExtents` lets a test check it.
import { advance, capHeight, type SlipFontKey } from "./slip-fonts";

export const SEAL = {
  box: 120,
  outerRadius: 58,
  innerRadius: 46,
  outerStroke: 2,
  innerStroke: 1,
  /** Arc text size and spacing, in box units. */
  arcSize: 7.2,
  arcSpacing: 1.5,
  /** The longest arc the top text may take, in degrees; longer names are tightened and then reduced. */
  maxTopArcDeg: 150,
  /** Degrees the centre block is turned (negative = anticlockwise). */
  tiltDeg: -8,
  /** The centre block never reaches closer than this to the inner ring (box units). */
  clearance: 3,
  arcFont: "F2" as SlipFontKey,
  confirmedFont: "F3" as SlipFontKey,
  confirmedSize: 10,
  confirmedSpacing: 0.5,
  bookedFont: "F2" as SlipFontKey,
  bookedSize: 6.6,
  bookedSpacing: 0.8,
  checkWidth: 9,
  checkGap: 3.5,
} as const;

/** One character set on an arc: its origin (baseline start) and the turn, clockwise in degrees, of its baseline. */
export interface ArcGlyph {
  char: string;
  x: number;
  y: number;
  rotateDeg: number;
  size: number;
  font: SlipFontKey;
  /** Width of the character, in box units. */
  width: number;
}

const rad = (deg: number) => (deg * Math.PI) / 180;
const deg = (radians: number) => (radians * 180) / Math.PI;

/** The radius of the text baseline for the top arc (letters stand outward) and the bottom arc (letters stand inward). */
export function arcBaselines(): { top: number; bottom: number } {
  const cap = capHeight(SEAL.arcFont, SEAL.arcSize);
  const middle = (SEAL.innerRadius + SEAL.innerStroke / 2 + SEAL.outerRadius - SEAL.outerStroke / 2) / 2;
  return { top: middle - cap / 2, bottom: middle + cap / 2 };
}

/** Size and spacing of arc text so its arc never exceeds `maxDeg` at the given baseline radius. */
function fitArc(text: string, radius: number, maxDeg: number): { size: number; spacing: number } {
  let size: number = SEAL.arcSize;
  let spacing: number = SEAL.arcSpacing;
  const arcOf = (s: number, sp: number) => deg(advance(text, SEAL.arcFont, s, sp) / radius);
  while (spacing > 0.3 && arcOf(size, spacing) > maxDeg) spacing -= 0.1;
  while (size > 5 && arcOf(size, spacing) > maxDeg) size -= 0.2;
  return { size, spacing };
}

/** Lays the characters of `text` along a circle: over the top reading clockwise, or along the bottom reading left to right. */
export function arcText(text: string, side: "top" | "bottom"): ArcGlyph[] {
  const baselines = arcBaselines();
  const radius = side === "top" ? baselines.top : baselines.bottom;
  const { size, spacing } = side === "top" ? fitArc(text, radius, SEAL.maxTopArcDeg) : { size: SEAL.arcSize, spacing: SEAL.arcSpacing };
  const chars = [...text.normalize("NFC")];
  const widths = chars.map((char) => advance(char, SEAL.arcFont, size));
  const total = widths.reduce((sum, w) => sum + w, 0) + spacing * (chars.length - 1);
  const glyphs: ArcGlyph[] = [];
  let travelled = 0;
  chars.forEach((char, index) => {
    const width = widths[index] ?? 0;
    // Angle (screen, y down) of the middle of this glyph on its baseline.
    const along = (travelled + width / 2 - total / 2) / radius;
    const angle = side === "top" ? -Math.PI / 2 + along : Math.PI / 2 - along;
    // Unit vector along the baseline in the direction of reading.
    const tangent = side === "top" ? { x: -Math.sin(angle), y: Math.cos(angle) } : { x: Math.sin(angle), y: -Math.cos(angle) };
    const centre = { x: radius * Math.cos(angle), y: radius * Math.sin(angle) };
    glyphs.push({
      char,
      x: centre.x - (tangent.x * width) / 2,
      y: centre.y - (tangent.y * width) / 2,
      rotateDeg: deg(Math.atan2(tangent.y, tangent.x)),
      size,
      font: SEAL.arcFont,
      width,
    });
    travelled += width + spacing;
  });
  return glyphs;
}

/** The centre block, before the tilt: lines of text with origins relative to the middle of the stamp. */
export interface CentreLine {
  text: string;
  x: number;
  y: number;
  font: SlipFontKey;
  size: number;
  spacing: number;
  width: number;
}
export interface CentreBlock {
  lines: CentreLine[];
  /** The check mark: its left end, the dip and the right end, as points. */
  check: [number, number][];
  /** Stroke width of the check mark. */
  checkStroke: number;
}

/** "07 OCT": the stamp shows the day and month of the booking, upper case. */
export function bookedLabel(bookedOn: string): string {
  return `BOOKED ${bookedOn.toUpperCase()}`;
}

export function centreBlock(booked: string): CentreBlock {
  const confirmed = "CONFIRMED";
  const maxHalfWidth = SEAL.innerRadius - SEAL.innerStroke / 2 - SEAL.clearance - 3; // leaves room for the line's height and the tilt
  let size: number = SEAL.confirmedSize;
  const widthAt = (s: number) => advance(confirmed, SEAL.confirmedFont, s, SEAL.confirmedSpacing) - SEAL.confirmedSpacing + SEAL.checkWidth + SEAL.checkGap;
  while (size > 6 && widthAt(size) / 2 > maxHalfWidth) size -= 0.2;
  const confirmedWidth = widthAt(size);
  const cap = capHeight(SEAL.confirmedFont, size);
  const bookedCap = capHeight(SEAL.bookedFont, SEAL.bookedSize);
  const lineGap = 5.5;
  // The pair (CONFIRMED over BOOKED ...) is centred on the stamp.
  const blockHeight = cap + lineGap + bookedCap;
  const confirmedBaseline = -blockHeight / 2 + cap;
  const bookedBaseline = confirmedBaseline + lineGap + bookedCap;
  let bookedSize: number = SEAL.bookedSize;
  while (bookedSize > 4.5 && advance(booked, SEAL.bookedFont, bookedSize, SEAL.bookedSpacing) / 2 > maxHalfWidth) bookedSize -= 0.2;
  const bookedWidth = advance(booked, SEAL.bookedFont, bookedSize, SEAL.bookedSpacing) - SEAL.bookedSpacing;
  const left = -confirmedWidth / 2;
  const mid = confirmedBaseline - cap / 2; // vertical middle of the capitals
  const unit = SEAL.checkWidth / 9;
  return {
    lines: [
      { text: confirmed, x: left + SEAL.checkWidth + SEAL.checkGap, y: confirmedBaseline, font: SEAL.confirmedFont, size, spacing: SEAL.confirmedSpacing, width: confirmedWidth - SEAL.checkWidth - SEAL.checkGap },
      { text: booked, x: -bookedWidth / 2, y: bookedBaseline, font: SEAL.bookedFont, size: bookedSize, spacing: SEAL.bookedSpacing, width: bookedWidth },
    ],
    check: [
      [left, mid + 0.2 * unit],
      [left + 3.2 * unit, mid + 3.4 * unit],
      [left + 9 * unit, mid - 3.6 * unit],
    ],
    checkStroke: Math.max(1.3, size * 0.16),
  };
}

/** What the stamp is made of, for one booking. */
export interface SealContent {
  top: ArcGlyph[];
  bottom: ArcGlyph[];
  centre: CentreBlock;
}

export function sealContent(input: { clinicName: string; booked: string; sample: boolean }): SealContent {
  return {
    top: arcText((input.clinicName || "Clinic").toUpperCase(), "top"),
    bottom: arcText(input.sample ? "• DEMO •" : "• APPOINTMENT •", "bottom"),
    centre: centreBlock(bookedLabel(input.booked)),
  };
}

/** Distance of every corner of every glyph and line from the stamp's centre: [nearest, farthest] over all text. */
export function sealExtents(content: SealContent): { arcs: [number, number]; centre: number } {
  let near = Infinity;
  let far = 0;
  for (const glyph of [...content.top, ...content.bottom]) {
    const cap = capHeight(glyph.font, glyph.size);
    const angle = rad(glyph.rotateDeg);
    const along = { x: Math.cos(angle), y: Math.sin(angle) };
    // The glyph's "up" is the baseline direction turned a quarter anticlockwise on screen.
    const up = { x: along.y, y: -along.x };
    for (const [u, v] of [[0, 0], [glyph.width, 0], [glyph.width, cap], [0, cap]] as const) {
      const distance = Math.hypot(glyph.x + along.x * u + up.x * v, glyph.y + along.y * u + up.y * v);
      near = Math.min(near, distance);
      far = Math.max(far, distance);
    }
  }
  let centre = 0;
  const turn = rad(SEAL.tiltDeg);
  const rotate = (x: number, y: number) => Math.hypot(x * Math.cos(turn) - y * Math.sin(turn), x * Math.sin(turn) + y * Math.cos(turn));
  for (const line of content.centre.lines) {
    const cap = capHeight(line.font, line.size);
    for (const [x, y] of [[line.x, line.y], [line.x + line.width, line.y], [line.x + line.width, line.y - cap], [line.x, line.y - cap]] as const) centre = Math.max(centre, rotate(x, y));
  }
  for (const [x, y] of content.centre.check) centre = Math.max(centre, rotate(x, y) + content.centre.checkStroke / 2);
  return { arcs: [near, far], centre };
}
