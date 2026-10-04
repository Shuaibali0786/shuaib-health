// The confirmation slip the visitor keeps: a PDF, a calendar file and a WhatsApp message.
// All three are built from the masked AppointmentView only (FR-051, FR-057): the full name, full
// mobile number, email and reason are never available here, so they can never leak into a file.
import { formatPkr } from "@/lib/format";
import { arriveByTime, formatLocalDate, formatLocalDateWithYear } from "./labels";
import { qrModules } from "./qr";
import type { AppointmentView } from "./schemas";

export interface SlipClinic {
  name: string;
  address: string[];
  phoneDisplay: string;
  phoneTel: string;
  /** The clinic's emergency line from the site settings; left out of the slip when empty. */
  emergencyDisplay?: string;
}

const KARACHI = "Asia/Karachi";

/** "PKT" for the clinic's own zone, otherwise the zone id. */
export function zoneLabel(timeZone: string): string {
  return timeZone === KARACHI ? "PKT" : timeZone;
}

/** "4 Oct 2026, 14:05 PKT": when the booking was made, in the appointment's own zone. */
export function formatBookedOn(bookedAt: string, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone, day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(bookedAt));
  const pick = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${pick("day")} ${pick("month")} ${pick("year")}, ${pick("hour")}:${pick("minute")} ${zoneLabel(timeZone)}`;
}

/** "04 Oct 2026": the booking date on the CONFIRMED seal. */
export function formatSealDate(bookedAt: string, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone, day: "2-digit", month: "short", year: "numeric" }).formatToParts(new Date(bookedAt));
  const pick = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${pick("day")} ${pick("month")} ${pick("year")}`;
}

export const ARRIVE_EARLY_MINUTES = 15;
export const SLIP_BRING = "Bring your CNIC and any previous reports.";
export const SLIP_DEMO_FOOTER = "Demo booking, no one will contact you";

export function slipFileName(view: Pick<AppointmentView, "reference">): string {
  return `appointment-slip-${view.reference}.pdf`;
}

// ---------------------------------------------------------------------------------------------
// WhatsApp
// ---------------------------------------------------------------------------------------------

export function whatsappText(view: AppointmentView, clinic: SlipClinic): string {
  const lines = [
    `Appointment booked${clinic.name ? ` at ${clinic.name}` : ""}`,
    `Reference: ${view.reference}`,
    `Doctor: ${view.doctor.fullName}`,
    `Date: ${formatLocalDate(view.localDate)}`,
    `Time: ${view.localTime} (${zoneLabel(view.timeZone)})`,
  ];
  if (clinic.phoneDisplay !== "") lines.push(`Clinic phone: ${clinic.phoneDisplay}`);
  return lines.join("\n");
}

export function whatsappLink(view: AppointmentView, clinic: SlipClinic): string {
  return `https://wa.me/?text=${encodeURIComponent(whatsappText(view, clinic))}`;
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

// ---------------------------------------------------------------------------------------------
// PDF: a one-page slip written by hand (standard fonts, vector logo), so no library ships to phones.
// ---------------------------------------------------------------------------------------------

const PAGE_W = 420;
const PAGE_H = 595;
const MARGIN = 30;

type Font = "F1" | "F2" | "F3"; // Helvetica, Helvetica-Bold, Times-Bold

/** Escapes text for a PDF string and maps anything outside Latin-1 to "?" (standard fonts). */
function pdfText(text: string): string {
  let out = "";
  for (const char of text.normalize("NFC")) {
    const code = char.codePointAt(0) ?? 63;
    const safe = code >= 32 && code <= 255 ? char : "?";
    out += safe === "(" || safe === ")" || safe === "\\" ? `\\${safe}` : safe;
  }
  return out;
}

/** Rough width of a standard-font string, from glyph classes. Good enough to centre and right-align. */
function textWidth(text: string, font: Font, size: number, spacing = 0): number {
  let em = 0;
  for (const char of text) {
    if ("iljt.,:;!|'".includes(char)) em += 0.28;
    else if (char === " ") em += 0.28;
    else if ("fr".includes(char)) em += 0.34;
    else if ("mwMW".includes(char)) em += 0.84;
    else if (/[0-9]/.test(char)) em += 0.556;
    else if (/[A-Z]/.test(char)) em += 0.68;
    else em += 0.52;
  }
  return em * size * (font === "F1" ? 1 : 1.06) + spacing * text.length;
}

/** Greedy wrap by an average Helvetica glyph width of 0.5 em. */
function wrap(text: string, size: number, width: number): string[] {
  const maxChars = Math.max(8, Math.floor(width / (size * 0.5)));
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/)) {
    if (line !== "" && line.length + 1 + word.length > maxChars) {
      lines.push(line);
      line = word;
    } else {
      line = line === "" ? word : `${line} ${word}`;
    }
  }
  if (line !== "") lines.push(line);
  return lines;
}

const num = (n: number): string => String(Math.round(n * 100) / 100);

/** The logo mark (public/images/brand/logo-mark.svg), 64 x 64 units: a rounded plus with a pulse line. */
function logoMark(ops: string[], x: number, top: number, size: number, fill: string, line: string): void {
  const k = size / 64;
  const px = (u: number) => num(x + u * k);
  const py = (u: number) => num(PAGE_H - top - u * k);
  const KAPPA = 0.5523;
  let cur: [number, number] = [29, 4];
  const path = [`${px(29)} ${py(4)} m`];
  const lineTo = (ux: number, uy: number) => {
    path.push(`${px(ux)} ${py(uy)} l`);
    cur = [ux, uy];
  };
  // A quarter circle about (cx, cy) from the current point to (ex, ey).
  const arc = (cx: number, cy: number, ex: number, ey: number) => {
    const c1: [number, number] = [cur[0] + KAPPA * (ex - cx), cur[1] + KAPPA * (ey - cy)];
    const c2: [number, number] = [ex + KAPPA * (cur[0] - cx), ey + KAPPA * (cur[1] - cy)];
    path.push(`${px(c1[0])} ${py(c1[1])} ${px(c2[0])} ${py(c2[1])} ${px(ex)} ${py(ey)} c`);
    cur = [ex, ey];
  };
  lineTo(35, 4);
  arc(35, 12, 43, 12);
  lineTo(43, 21);
  lineTo(52, 21);
  arc(52, 29, 60, 29);
  lineTo(60, 35);
  arc(52, 35, 52, 43);
  lineTo(43, 43);
  lineTo(43, 52);
  arc(35, 52, 35, 60);
  lineTo(29, 60);
  arc(29, 52, 21, 52);
  lineTo(21, 43);
  lineTo(12, 43);
  arc(12, 35, 4, 35);
  lineTo(4, 29);
  arc(12, 29, 12, 21);
  lineTo(21, 21);
  lineTo(21, 12);
  arc(29, 12, 29, 4);
  ops.push(`${fill} rg ${path.join(" ")} f`);
  ops.push(
    `${line} RG ${num(3.5 * k)} w 1 J 1 j ${px(6)} ${py(32)} m ${px(16)} ${py(32)} l ` +
      `${px(21)} ${py(32)} ${px(22)} ${py(24)} ${px(31)} ${py(24)} c ${px(38)} ${py(24)} ${px(39)} ${py(29.5)} ${px(32)} ${py(32)} c ` +
      `${px(25)} ${py(34.5)} ${px(26)} ${py(40)} ${px(33)} ${py(40)} c ${px(42)} ${py(40)} ${px(43)} ${py(32)} ${px(48)} ${py(32)} c ${px(58)} ${py(32)} l S`,
  );
}

export function buildSlipPdf(view: AppointmentView, clinic: SlipClinic): Uint8Array<ArrayBuffer> {
  const ops: string[] = [];
  const rgb = (r: number, g: number, b: number) => `${num(r / 255)} ${num(g / 255)} ${num(b / 255)}`;
  const NAVY = rgb(11, 37, 69);
  const TEAL = rgb(15, 118, 110);
  const TEAL_BRAND = rgb(20, 184, 166);
  const TEAL_LIGHT = rgb(94, 234, 212);
  const TEAL_TINT = rgb(240, 253, 250);
  const GOLD = rgb(184, 146, 58);
  const GOLD_TEXT = rgb(122, 92, 20);
  const MUTED = rgb(91, 107, 127);
  const INK = rgb(34, 52, 79);
  const RULE = rgb(220, 230, 238);
  const WHITE = "1 1 1";
  const Y = (top: number) => PAGE_H - top; // measure down from the top edge

  type TextOptions = { spacing?: number; align?: "left" | "center" | "right" };
  const text = (value: string, x: number, top: number, font: Font, size: number, color: string, { spacing = 0, align = "left" }: TextOptions = {}) => {
    const width = textWidth(value, font, size, spacing);
    const left = align === "center" ? x - width / 2 : align === "right" ? x - width : x;
    ops.push(`BT /${font} ${size} Tf ${color} rg ${num(spacing)} Tc ${num(left)} ${num(Y(top))} Td (${pdfText(value)}) Tj ET`);
  };
  const rect = (x: number, top: number, w: number, h: number, color: string) => {
    ops.push(`${color} rg ${num(x)} ${num(Y(top + h))} ${num(w)} ${num(h)} re f`);
  };
  const frame = (x: number, top: number, w: number, h: number, color: string, width = 0.8, fill?: string) => {
    ops.push(`${fill ? `${fill} rg ` : ""}${color} RG ${num(width)} w ${num(x)} ${num(Y(top + h))} ${num(w)} ${num(h)} re ${fill ? "B" : "S"}`);
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

  // Faint logo watermark behind everything, then a fine gold frame.
  logoMark(ops, PAGE_W / 2 - 130, 190, 260, rgb(244, 250, 249), WHITE);
  frame(12, 12, PAGE_W - 24, PAGE_H - 24, GOLD, 0.7);

  // Header: navy band, logo, clinic name, gold rule.
  rect(12.4, 12.4, PAGE_W - 24.8, 76, NAVY);
  logoMark(ops, MARGIN, 26, 46, TEAL_BRAND, WHITE);
  text(clinic.name || "Clinic", MARGIN + 60, 52, "F3", 19, WHITE);
  text("APPOINTMENT SLIP", MARGIN + 60, 68, "F2", 8, TEAL_LIGHT, { spacing: 2 });
  hairline(12.4, PAGE_W - 12.4, 88.4, GOLD);

  // Highlight box: date with year, time, arrive-by.
  const boxTop = 102;
  frame(MARGIN, boxTop, innerW, 80, GOLD, 0.9, TEAL_TINT);
  text("YOUR APPOINTMENT", MARGIN + 16, boxTop + 18, "F2", 7.5, GOLD_TEXT, { spacing: 1.6 });
  text(formatLocalDateWithYear(view.localDate), MARGIN + 16, boxTop + 40, "F3", 22, NAVY);
  text(`${view.localTime} (${zoneLabel(view.timeZone)})`, MARGIN + 16, boxTop + 60, "F3", 17, TEAL);
  text(`Please arrive by ${arriveByTime(view.localTime)}`, MARGIN + 16, boxTop + 73, "F2", 9.5, NAVY);

  // CONFIRMED seal, slightly rotated, inside the box's right side.
  const sealDate = formatSealDate(view.bookedAt, view.timeZone);
  const angle = (-12 * Math.PI) / 180;
  ops.push(`q ${num(Math.cos(angle))} ${num(Math.sin(angle))} ${num(-Math.sin(angle))} ${num(Math.cos(angle))} ${num(right - 52)} ${num(Y(boxTop + 44))} cm`);
  circle(0, 0, 40, TEAL, 1.6, WHITE);
  circle(0, 0, 35, TEAL, 0.6);
  const sealName = wrap(clinic.name || "Clinic", 6, 54).slice(0, 2);
  sealName.forEach((line, index) => ops.push(`BT /F2 6 Tf ${TEAL} rg ${num(-textWidth(line.toUpperCase(), "F2", 6) / 2)} ${num(23 - index * 7)} Td (${pdfText(line.toUpperCase())}) Tj ET`));
  ops.push(`BT /F2 11 Tf ${TEAL} rg 0.6 Tc ${num(-textWidth("CONFIRMED", "F2", 11, 0.6) / 2)} 2 Td (CONFIRMED) Tj ET`);
  ops.push(`BT /F1 6 Tf ${GOLD_TEXT} rg 0 Tc ${num(-textWidth(sealDate, "F1", 6) / 2)} -11 Td (${pdfText(sealDate)}) Tj ET`);
  if (view.isSample) ops.push(`BT /F2 5.5 Tf ${MUTED} rg 0.8 Tc ${num(-textWidth("DEMO", "F2", 5.5, 0.8) / 2)} -22 Td (DEMO) Tj ET`);
  ops.push("Q");

  // Visit details.
  let top = 202;
  text("VISIT DETAILS", MARGIN, top, "F2", 7.5, GOLD_TEXT, { spacing: 1.6 });
  hairline(MARGIN, right, top + 6, RULE);
  top += 22;
  const valueX = MARGIN + 82;
  const valueWidth = right - valueX;
  const row = (label: string, value: string, sub?: string) => {
    text(label, MARGIN, top, "F1", 9, MUTED);
    const lines = wrap(value, 11, valueWidth);
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
    const lines = [...clinic.address.flatMap((line) => wrap(line, 10, valueWidth)), ...(clinic.phoneDisplay !== "" ? [clinic.phoneDisplay] : [])];
    lines.forEach((line, index) => text(line, valueX, top + index * 12, index === lines.length - 1 && clinic.phoneDisplay !== "" ? "F2" : "F1", 10, INK));
  }

  // Before you come.
  const tipsTop = 374;
  const tips = [`Arrive ${ARRIVE_EARLY_MINUTES} minutes early.`, SLIP_BRING, ...(clinic.emergencyDisplay ? [`Emergency? Call ${clinic.emergencyDisplay}.`] : [])];
  frame(MARGIN, tipsTop, innerW, 22 + tips.length * 14, GOLD, 0.7);
  text("Before you come", MARGIN + 14, tipsTop + 17, "F3", 11.5, NAVY);
  tips.forEach((tip, index) => {
    circle(MARGIN + 18, Y(tipsTop + 29 + index * 14) + 3, 1.6, TEAL, 0.5, TEAL);
    text(tip, MARGIN + 26, tipsTop + 31 + index * 14, "F1", 9.5, INK);
  });

  // Perforated divider with a notch at each edge, then the stub: reference and QR.
  const perfTop = 452;
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
  hairline(MARGIN, right, 542, RULE);
  text(`Booked on ${formatBookedOn(view.bookedAt, view.timeZone)}`, MARGIN, 557, "F1", 8.5, MUTED);
  text(SLIP_DEMO_FOOTER, MARGIN, 570, "F1", 8.5, MUTED);

  const content = ops.join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Resources << /Font << /F1 5 0 R /F2 6 0 R /F3 7 0 R >> >> /Contents 4 0 R >>`,
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Times-Bold /Encoding /WinAnsiEncoding >>",
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
