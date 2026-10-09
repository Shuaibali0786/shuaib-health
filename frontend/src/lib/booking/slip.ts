// The confirmation slip the visitor keeps: a PDF, a calendar file and a WhatsApp message.
// All three are built from the masked AppointmentView only (FR-051, FR-057): the full name, full
// mobile number, email and reason are never available here, so they can never leak into a file.
import { MARK_COLOURS, MARK_LARGE, MARK_SMALL, MARK_VIEWBOX, SMALL_MARK_MAX_PX } from "@/lib/brand-marks";
import { formatPkr } from "@/lib/format";
import { arriveByTime, formatLocalDateWithYear, zoneLabel } from "./labels";
import { qrModules } from "./qr";
import { SEAL, sealContent } from "./seal";
import { SLIP_FONT_KEYS, SLIP_FONT_METRICS, advance, winAnsiCode, type SlipFontKey, type SlipFonts } from "./slip-fonts";
import type { AppointmentView } from "./schemas";

export { zoneLabel } from "./labels";

const KARACHI = "Asia/Karachi";

export interface SlipClinic {
  name: string;
  address: string[];
  phoneDisplay: string;
  phoneTel: string;
  /** The clinic's emergency line from the site settings; left out of the slip when empty. */
  emergencyDisplay?: string;
}

/** "4 Oct 2026, 14:05 PKT": when the booking was made, in the appointment's own zone. */
export function formatBookedOn(bookedAt: string, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone, day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(bookedAt));
  const pick = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${pick("day")} ${pick("month")} ${pick("year")}, ${pick("hour")}:${pick("minute")} ${zoneLabel(timeZone)}`;
}

export const ARRIVE_EARLY_MINUTES = 15;
export const SLIP_BRING = "Bring your CNIC and any previous reports.";
export const SLIP_DEMO_FOOTER = "Demo booking, no one will contact you";

export function slipFileName(view: Pick<AppointmentView, "reference">): string {
  return `appointment-slip-${view.reference}.pdf`;
}

// ---------------------------------------------------------------------------------------------
// Calendar (.ics)
// ---------------------------------------------------------------------------------------------

const icsEscape = (text: string): string =>
  text.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

/** RFC 5545 line folding: no line longer than 75 octets (all text here is plain ASCII or short UTF-8). */
function fold(line: string): string {
  const encoder = new TextEncoder();
  if (encoder.encode(line).length <= 75) return line;
  const parts: string[] = [];
  let current = "";
  let size = 0;
  for (const char of line) {
    const width = encoder.encode(char).length;
    if (size + width > (parts.length === 0 ? 75 : 74)) {
      parts.push(current);
      current = "";
      size = 0;
    }
    current += char;
    size += width;
  }
  parts.push(current);
  return parts.join("\r\n ");
}

/** `YYYYMMDDTHHMMSS` for an instant, as read on a wall clock in `timeZone`. */
function wallClock(instant: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);
  const pick = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  return `${pick("year")}${pick("month")}${pick("day")}T${pick("hour")}${pick("minute")}${pick("second")}`;
}

const utcStamp = (instant: Date): string => `${wallClock(instant, "UTC")}Z`;

export function buildCalendarIcs(view: AppointmentView, clinic: SlipClinic, now: Date = new Date()): string {
  const starts = new Date(view.startsAt);
  const ends = new Date(view.endsAt);
  const karachi = view.timeZone === KARACHI;
  const start = karachi ? `DTSTART;TZID=${KARACHI}:${wallClock(starts, KARACHI)}` : `DTSTART:${utcStamp(starts)}`;
  const end = karachi ? `DTEND;TZID=${KARACHI}:${wallClock(ends, KARACHI)}` : `DTEND:${utcStamp(ends)}`;
  const description = [`Booking reference: ${view.reference}`, `Doctor: ${view.doctor.fullName}`, clinic.phoneDisplay !== "" ? `Clinic phone: ${clinic.phoneDisplay}` : ""]
    .filter((line) => line !== "")
    .join("\n");

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Shuaib Health//Appointment slip//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    ...(karachi
      ? ["BEGIN:VTIMEZONE", `TZID:${KARACHI}`, "BEGIN:STANDARD", "DTSTART:19700101T000000", "TZOFFSETFROM:+0500", "TZOFFSETTO:+0500", "TZNAME:PKT", "END:STANDARD", "END:VTIMEZONE"]
      : []),
    "BEGIN:VEVENT",
    `UID:${view.reference}@appointment.shuaib-health`,
    `DTSTAMP:${utcStamp(now)}`,
    start,
    end,
    `SUMMARY:${icsEscape(`Appointment with ${view.doctor.fullName}`)}`,
    `DESCRIPTION:${icsEscape(description)}`,
    ...(clinic.address.length > 0 ? [`LOCATION:${icsEscape(clinic.address.join(", "))}`] : []),
    "STATUS:CONFIRMED",
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return `${lines.map(fold).join("\r\n")}\r\n`;
}

// PDF: a one-page slip written by hand (vector logo and stamp, the website's fonts embedded), so no PDF
// library ships to phones. The fonts come in as bytes (see slip-fonts.ts); text is in WinAnsi, one byte a character.
// ---------------------------------------------------------------------------------------------

const PAGE_W = 420;
const PAGE_H = 595 + 40; // the first design's page, plus the room the appointment box gained
const MARGIN = 30;
/** Height the appointment box gained: it now holds the arrive-by pill and the whole stamp inside its border. */
const BOX_EXTRA = 40;
/** Diameter of the CONFIRMED stamp on the page, in points. */
const SEAL_PT = 76;

/** The day and month the stamp shows: "07 Oct". */
export function formatSealBooked(bookedAt: string, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone, day: "2-digit", month: "short" }).formatToParts(new Date(bookedAt));
  const pick = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${pick("day")} ${pick("month")}`;
}

/** Escapes text for a PDF string; characters the fonts do not hold become "?". */
function pdfText(text: string): string {
  let out = "";
  for (const char of text.normalize("NFC")) {
    const safe = String.fromCharCode(winAnsiCode(char));
    out += safe === "(" || safe === ")" || safe === "\\" ? `\\${safe}` : safe;
  }
  return out;
}

/** Greedy wrap by the measured width of the words. */
function wrap(text: string, font: SlipFontKey, size: number, width: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/)) {
    if (line !== "" && advance(`${line} ${word}`, font, size) > width) {
      lines.push(line);
      line = word;
    } else {
      line = line === "" ? word : `${line} ${word}`;
    }
  }
  if (line !== "") lines.push(line);
  return lines;
}

/** The largest size, down to `min`, at which `text` fits in `width`. */
function fitSize(text: string, font: SlipFontKey, size: number, width: number, min: number): number {
  let fitted = size;
  while (fitted > min && advance(text, font, fitted) > width) fitted -= 0.5;
  return fitted;
}

/** Raw bytes as a string of Latin-1 characters, for writing into the PDF. */
function binary(bytes: Uint8Array): string {
  let out = "";
  for (let i = 0; i < bytes.length; i += 8192) out += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return out;
}

const num = (n: number): string => String(Math.round(n * 100) / 100);

/** "#RRGGBB" as PDF colour operands: "0.04 0.12 0.23". */
function hexRgb(hex: string): string {
  return [1, 3, 5].map((i) => num(parseInt(hex.slice(i, i + 2), 16) / 255)).join(" ");
}

/** A filled rounded rectangle, x and top measured from the page's top-left, in points. */
function roundedRect(ops: string[], x: number, top: number, w: number, h: number, r: number, color: string): void {
  const k = r * 0.5523;
  const y = PAGE_H - top - h; // PDF y runs up
  ops.push(
    `${color} rg ${num(x + r)} ${num(y)} m ${num(x + w - r)} ${num(y)} l ${num(x + w - r + k)} ${num(y)} ${num(x + w)} ${num(y + r - k)} ${num(x + w)} ${num(y + r)} c ` +
      `${num(x + w)} ${num(y + h - r)} l ${num(x + w)} ${num(y + h - r + k)} ${num(x + w - r + k)} ${num(y + h)} ${num(x + w - r)} ${num(y + h)} c ` +
      `${num(x + r)} ${num(y + h)} l ${num(x + r - k)} ${num(y + h)} ${num(x)} ${num(y + h - r + k)} ${num(x)} ${num(y + h - r)} c ` +
      `${num(x)} ${num(y + r)} l ${num(x)} ${num(y + r - k)} ${num(x + r - k)} ${num(y)} ${num(x + r)} ${num(y)} c f`,
  );
}

/**
 * The Booking Plus mark (lib/brand-marks.ts), drawn as vector rectangles: a calendar body, two
 * binder rings and a plus. `tone` "night" suits the navy header band, "light" the watermark on white.
 */
function logoMark(ops: string[], x: number, top: number, size: number, tone: "light" | "night"): void {
  const k = size / MARK_VIEWBOX;
  const colours = MARK_COLOURS[tone];
  for (const r of size <= SMALL_MARK_MAX_PX ? MARK_SMALL : MARK_LARGE) {
    roundedRect(ops, x + r.x * k, top + r.y * k, r.width * k, r.height * k, r.rx * k, hexRgb(colours[r.part]));
  }
}

export function buildSlipPdf(view: AppointmentView, clinic: SlipClinic, fonts: SlipFonts): Uint8Array<ArrayBuffer> {
  const ops: string[] = [];
  const rgb = (r: number, g: number, b: number) => `${num(r / 255)} ${num(g / 255)} ${num(b / 255)}`;
  const NAVY = rgb(11, 37, 69);
  const TEAL = rgb(15, 118, 110);
  const TEAL_LIGHT = rgb(94, 234, 212);
  const TEAL_TINT = rgb(240, 253, 250);
  const GOLD = rgb(184, 146, 58);
  const GOLD_TEXT = rgb(122, 92, 20);
  const MUTED = rgb(91, 107, 127);
  const INK = rgb(34, 52, 79);
  const RULE = rgb(220, 230, 238);
  const WHITE = "1 1 1";
  const Y = (top: number) => PAGE_H - top; // measure down from the top edge
  const X = BOX_EXTRA;

  type TextOptions = { spacing?: number; align?: "left" | "center" | "right" };
  const text = (value: string, x: number, top: number, font: SlipFontKey, size: number, color: string, { spacing = 0, align = "left" }: TextOptions = {}) => {
    const width = advance(value, font, size, spacing);
    const left = align === "center" ? x - width / 2 : align === "right" ? x - width : x;
    ops.push(`BT /${font} ${num(size)} Tf ${color} rg ${num(spacing)} Tc ${num(left)} ${num(Y(top))} Td (${pdfText(value)}) Tj ET`);
  };
  const rect = (x: number, top: number, w: number, h: number, color: string) => {
    ops.push(`${color} rg ${num(x)} ${num(Y(top + h))} ${num(w)} ${num(h)} re f`);
  };
  const frame = (x: number, top: number, w: number, h: number, color: string, width = 0.8, fill?: string) => {
    ops.push(`${fill ? `${fill} rg ` : ""}${color} RG ${num(width)} w ${num(x)} ${num(Y(top + h))} ${num(w)} ${num(h)} re ${fill ? "B" : "S"}`);
  };
  const roundRect = (x: number, top: number, w: number, h: number, r: number, color: string) => {
    const k = r * 0.5523;
    const y = Y(top + h);
    ops.push(
      `${color} rg ${num(x + r)} ${num(y)} m ${num(x + w - r)} ${num(y)} l ${num(x + w - r + k)} ${num(y)} ${num(x + w)} ${num(y + r - k)} ${num(x + w)} ${num(y + r)} c ` +
        `${num(x + w)} ${num(y + h - r)} l ${num(x + w)} ${num(y + h - r + k)} ${num(x + w - r + k)} ${num(y + h)} ${num(x + w - r)} ${num(y + h)} c ` +
        `${num(x + r)} ${num(y + h)} l ${num(x + r - k)} ${num(y + h)} ${num(x)} ${num(y + h - r + k)} ${num(x)} ${num(y + h - r)} c ` +
        `${num(x)} ${num(y + r)} l ${num(x)} ${num(y + r - k)} ${num(x + r - k)} ${num(y)} ${num(x + r)} ${num(y)} c f`,
    );
  };
  const hairline = (x1: number, x2: number, top: number, color: string, dash = "") => {
    ops.push(`${color} RG 0.8 w ${dash ? `[${dash}] 0 d ` : ""}${num(x1)} ${num(Y(top))} m ${num(x2)} ${num(Y(top))} l S${dash ? " [] 0 d" : ""}`);
  };
  const circle = (cx: number, cy: number, r: number, color: string, width: number, fill?: string) => {
    const c = r * 0.5523;
    ops.push(
      `${fill ? `${fill} rg ` : ""}${color} RG ${num(width)} w ${num(cx + r)} ${num(cy)} m ` +
        `${num(cx + r)} ${num(cy + c)} ${num(cx + c)} ${num(cy + r)} ${num(cx)} ${num(cy + r)} c ` +
        `${num(cx - c)} ${num(cy + r)} ${num(cx - r)} ${num(cy + c)} ${num(cx - r)} ${num(cy)} c ` +
        `${num(cx - r)} ${num(cy - c)} ${num(cx - c)} ${num(cy - r)} ${num(cx)} ${num(cy - r)} c ` +
        `${num(cx + c)} ${num(cy - r)} ${num(cx + r)} ${num(cy - c)} ${num(cx + r)} ${num(cy)} c ${fill ? "B" : "S"}`,
    );
  };

  const right = PAGE_W - MARGIN;
  const innerW = PAGE_W - 2 * MARGIN;

  // Faint logo watermark behind everything, at the page's 4 %: centred on the visit details, wholly inside that band, so it
  // can never reach the header, the stamp, the QR or the page edge. Then a fine gold frame.
  const detailsTop = 202 + X;
  const detailsBottom = 374 + X; // where the "Before you come" box starts
  const markSize = 140;
  ops.push("q /GS1 gs");
  logoMark(ops, (PAGE_W - markSize) / 2, (detailsTop + detailsBottom - markSize) / 2, markSize, "light");
  ops.push("Q");
  frame(12, 12, PAGE_W - 24, PAGE_H - 24, GOLD, 0.7);

  // Header: navy band, logo, clinic name, gold rule.
  rect(12.4, 12.4, PAGE_W - 24.8, 76, NAVY);
  logoMark(ops, MARGIN, 26, 46, "night");
  text(clinic.name || "Clinic", MARGIN + 60, 52, "F3", 19, WHITE);
  text("APPOINTMENT SLIP", MARGIN + 60, 68, "F2", 8, TEAL_LIGHT, { spacing: 2 });
  hairline(12.4, PAGE_W - 12.4, 88.4, GOLD);

  // Highlight box: date with year, time, the CONFIRMED stamp inside it, and the arrive-by pill across the foot.
  const boxTop = 102;
  const boxHeight = 80 + X;
  frame(MARGIN, boxTop, innerW, boxHeight, GOLD, 0.9, TEAL_TINT);
  const sealCx = right - 14 - SEAL_PT / 2;
  const sealTop = boxTop + 8;
  const textWidthMax = sealCx - SEAL_PT / 2 - 10 - (MARGIN + 16);
  text("YOUR APPOINTMENT", MARGIN + 16, boxTop + 18, "F2", 7.5, GOLD_TEXT, { spacing: 1.6 });
  const dateText = formatLocalDateWithYear(view.localDate);
  text(dateText, MARGIN + 16, boxTop + 40, "F3", fitSize(dateText, "F3", 22, textWidthMax, 14), NAVY);
  const timeText = `${view.localTime} (${zoneLabel(view.timeZone)})`;
  text(timeText, MARGIN + 16, boxTop + 60, "F3", fitSize(timeText, "F3", 17, textWidthMax, 12), TEAL);

  // Stamp: the page's SVG, drawn from the same layout (seal.ts). Y runs up here, so every y is flipped.
  const k = SEAL_PT / SEAL.box;
  const sealCy = Y(sealTop + SEAL_PT / 2);
  const content = sealContent({ clinicName: clinic.name, booked: formatSealBooked(view.bookedAt, view.timeZone), sample: view.isSample });
  circle(sealCx, sealCy, SEAL.outerRadius * k, TEAL, SEAL.outerStroke * k, WHITE);
  circle(sealCx, sealCy, SEAL.innerRadius * k, TEAL, SEAL.innerStroke * k);
  const place = (font: SlipFontKey, size: number, color: string, spacing: number, turnDeg: number, x: number, y: number, value: string) => {
    const a = (turnDeg * Math.PI) / 180;
    ops.push(`BT /${font} ${num(size * k)} Tf ${color} rg ${num(spacing * k)} Tc ${num(Math.cos(a))} ${num(-Math.sin(a))} ${num(Math.sin(a))} ${num(Math.cos(a))} ${num(sealCx + x * k)} ${num(sealCy - y * k)} Tm (${pdfText(value)}) Tj ET`);
  };
  for (const glyph of [...content.top, ...content.bottom]) place(glyph.font, glyph.size, TEAL, 0, glyph.rotateDeg, glyph.x, glyph.y, glyph.char);
  const tilt = (SEAL.tiltDeg * Math.PI) / 180;
  const tilted = (x: number, y: number): [number, number] => [x * Math.cos(tilt) - y * Math.sin(tilt), x * Math.sin(tilt) + y * Math.cos(tilt)];
  content.centre.lines.forEach((line, index) => {
    const [x, y] = tilted(line.x, line.y);
    place(line.font, line.size, index === 0 ? TEAL : GOLD_TEXT, line.spacing, SEAL.tiltDeg, x, y, line.text);
  });
  const [c0, c1, c2] = content.centre.check.map(([x, y]) => tilted(x, y));
  const at = (p: [number, number] | undefined) => `${num(sealCx + (p?.[0] ?? 0) * k)} ${num(sealCy - (p?.[1] ?? 0) * k)}`;
  ops.push(`${TEAL} RG ${num(content.centre.checkStroke * k)} w 1 J 1 j ${at(c0)} m ${at(c1)} l ${at(c2)} l S`);

  // Arrive-by pill, navy as on the page.
  const pillTop = boxTop + boxHeight - 8 - 22;
  roundRect(MARGIN + 12, pillTop, innerW - 24, 22, 6, NAVY);
  const arrive = "Please arrive by ";
  text(arrive, MARGIN + 24, pillTop + 14.6, "F2", 9.5, WHITE);
  text(arriveByTime(view.localTime), MARGIN + 24 + advance(arrive, "F2", 9.5), pillTop + 14.6, "F2", 9.5, TEAL_LIGHT);

  // Visit details.
  let top = 202 + X;
  text("VISIT DETAILS", MARGIN, top, "F2", 7.5, GOLD_TEXT, { spacing: 1.6 });
  hairline(MARGIN, right, top + 6, RULE);
  top += 22;
  const valueX = MARGIN + 82;
  const valueWidth = right - valueX;
  const row = (label: string, value: string, sub?: string) => {
    text(label, MARGIN, top, "F1", 9, MUTED);
    const lines = wrap(value, "F2", 11, valueWidth);
    lines.forEach((line, index) => text(line, valueX, top + index * 13, "F2", 11, INK));
    top += (lines.length - 1) * 13;
    if (sub) {
      top += 12;
      text(sub, valueX, top, "F1", 9, MUTED);
    }
    top += 19;
  };
  row("Patient", view.patientNameMasked);
  row("Mobile", view.mobileMasked);
  row("Doctor", view.doctor.fullName, view.doctor.specialty);
  row("Department", view.department.name);
  row("Fee", `${formatPkr(view.feePkr)} (sample)`);
  if (clinic.address.length > 0 || clinic.phoneDisplay !== "") {
    text("Clinic", MARGIN, top, "F1", 9, MUTED);
    const lines = [...clinic.address.flatMap((line) => wrap(line, "F1", 10, valueWidth)), ...(clinic.phoneDisplay !== "" ? [clinic.phoneDisplay] : [])];
    lines.forEach((line, index) => text(line, valueX, top + index * 12, index === lines.length - 1 && clinic.phoneDisplay !== "" ? "F2" : "F1", 10, INK));
  }

  // Before you come.
  const tipsTop = 374 + X;
  const tips = [`Arrive ${ARRIVE_EARLY_MINUTES} minutes early.`, SLIP_BRING, ...(clinic.emergencyDisplay ? [`Emergency? Call ${clinic.emergencyDisplay}.`] : [])];
  frame(MARGIN, tipsTop, innerW, 22 + tips.length * 14, GOLD, 0.7);
  text("Before you come", MARGIN + 14, tipsTop + 17, "F3", 11.5, NAVY);
  tips.forEach((tip, index) => {
    circle(MARGIN + 18, Y(tipsTop + 29 + index * 14) + 3, 1.6, TEAL, 0.5, TEAL);
    text(tip, MARGIN + 26, tipsTop + 31 + index * 14, "F1", 9.5, INK);
  });

  // Perforated divider with a notch at each edge, then the stub: reference and QR.
  const perfTop = 452 + X;
  hairline(MARGIN + 6, right - 6, perfTop, GOLD, "3 3");
  circle(12, Y(perfTop), 8, GOLD, 0.7, WHITE);
  circle(PAGE_W - 12, Y(perfTop), 8, GOLD, 0.7, WHITE);
  text("BOOKING REFERENCE", MARGIN, perfTop + 26, "F2", 7.5, GOLD_TEXT, { spacing: 1.6 });
  text(view.reference, MARGIN, perfTop + 54, "F3", 26, NAVY, { spacing: 1.5 });
  text("Keep this slip. It is your appointment ticket.", MARGIN, perfTop + 72, "F1", 8.5, MUTED);

  const modules = qrModules(view.reference); // the booking reference and nothing else
  const cell = 2.5;
  const qrSize = modules.length * cell;
  const qrX = right - qrSize - 4;
  const qrTop = perfTop + 14;
  frame(qrX - 5, qrTop - 5, qrSize + 10, qrSize + 10, RULE, 0.8, WHITE);
  ops.push(`${NAVY} rg`);
  modules.forEach((moduleRow, r) => {
    let c = 0;
    while (c < moduleRow.length) {
      if (!moduleRow[c]) {
        c++;
        continue;
      }
      let end = c;
      while (moduleRow[end]) end++;
      ops.push(`${num(qrX + c * cell)} ${num(Y(qrTop + (r + 1) * cell))} ${num((end - c) * cell)} ${num(cell)} re f`);
      c = end;
    }
  });
  text("Show at reception", qrX + qrSize / 2, qrTop + qrSize + 14, "F2", 8, NAVY, { align: "center" });

  // Footer.
  hairline(MARGIN, right, 542 + X, RULE);
  text(`Booked on ${formatBookedOn(view.bookedAt, view.timeZone)}`, MARGIN, 557 + X, "F1", 8.5, MUTED);
  text(SLIP_DEMO_FOOTER, MARGIN, 570 + X, "F1", 8.5, MUTED);

  // Objects: 1 catalog, 2 pages, 3 page, 4 content, 5-7 fonts, 8-10 font descriptors, 11-13 font files, 14 the watermark's transparency.
  const stream = ops.join("\n");
  const fontObjects = SLIP_FONT_KEYS.map((key, i) => {
    const m = SLIP_FONT_METRICS[key];
    return `<< /Type /Font /Subtype /TrueType /BaseFont /${m.name} /FirstChar ${m.firstChar} /LastChar 255 /Widths [${m.widths.join(" ")}] /FontDescriptor ${8 + i} 0 R /Encoding /WinAnsiEncoding >>`;
  });
  const descriptors = SLIP_FONT_KEYS.map((key, i) => {
    const m = SLIP_FONT_METRICS[key];
    return `<< /Type /FontDescriptor /FontName /${m.name} /Flags 32 /FontBBox [${m.bbox.join(" ")}] /ItalicAngle 0 /Ascent ${m.ascent} /Descent ${m.descent} /CapHeight ${m.capHeight} /StemV 80 /FontFile2 ${11 + i} 0 R >>`;
  });
  const fontFiles = SLIP_FONT_KEYS.map((key) => `<< /Length ${fonts[key].length} /Length1 ${fonts[key].length} >>\nstream\n${binary(fonts[key])}\nendstream`);
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Resources << /Font << /F1 5 0 R /F2 6 0 R /F3 7 0 R >> /ExtGState << /GS1 14 0 R >> >> /Contents 4 0 R >>`,
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    ...fontObjects,
    ...descriptors,
    ...fontFiles,
    "<< /Type /ExtGState /ca 0.04 /CA 0.04 >>",
  ];

  // Every character is Latin-1, so string length equals byte length and the xref offsets are exact.
  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((body, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;

  const bytes = new Uint8Array(pdf.length);
  for (let i = 0; i < pdf.length; i++) bytes[i] = pdf.charCodeAt(i) & 0xff;
  return bytes;
}
