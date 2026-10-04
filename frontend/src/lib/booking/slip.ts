// The confirmation slip the visitor keeps: a PDF, a calendar file and a WhatsApp message.
// All three are built from the masked AppointmentView only (FR-051, FR-057): the full name, full
// mobile number, email and reason are never available here, so they can never leak into a file.
import { formatPkr } from "@/lib/format";
import { formatLocalDate } from "./labels";
import type { AppointmentView } from "./schemas";

export interface SlipClinic {
  name: string;
  address: string[];
  phoneDisplay: string;
  phoneTel: string;
}

const KARACHI = "Asia/Karachi";

/** "PKT" for the clinic's own zone, otherwise the zone id. */
function zoneLabel(timeZone: string): string {
  return timeZone === KARACHI ? "PKT" : timeZone;
}

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
const MARGIN = 36;

type Font = "F1" | "F2" | "F3"; // Helvetica, Helvetica-Bold, Courier-Bold

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

export function buildSlipPdf(view: AppointmentView, clinic: SlipClinic): Uint8Array<ArrayBuffer> {
  const ops: string[] = [];
  const rgb = (r: number, g: number, b: number) => `${num(r / 255)} ${num(g / 255)} ${num(b / 255)}`;
  const NAVY = rgb(11, 37, 69);
  const TEAL = rgb(15, 118, 110);
  const TEAL_LIGHT = rgb(94, 234, 212);
  const MUTED = rgb(91, 107, 127);
  const INK = rgb(34, 52, 79);
  const WHITE = "1 1 1";

  const text = (value: string, x: number, y: number, font: Font, size: number, color: string) => {
    ops.push(`BT /${font} ${size} Tf ${color} rg ${num(x)} ${num(y)} Td (${pdfText(value)}) Tj ET`);
  };
  const rect = (x: number, y: number, w: number, h: number, color: string) => {
    ops.push(`${color} rg ${num(x)} ${num(y)} ${num(w)} ${num(h)} re f`);
  };

  // Header band with the logo mark (a plus) and the clinic name.
  rect(0, PAGE_H - 96, PAGE_W, 96, NAVY);
  rect(MARGIN + 15, PAGE_H - 78, 14, 44, TEAL_LIGHT);
  rect(MARGIN, PAGE_H - 63, 44, 14, TEAL_LIGHT);
  text(clinic.name || "Clinic", MARGIN + 60, PAGE_H - 52, "F2", 17, WHITE);
  text("Appointment slip", MARGIN + 60, PAGE_H - 70, "F1", 11, TEAL_LIGHT);

  let y = PAGE_H - 96 - 34;
  if (view.isSample) {
    text("DEMO BOOKING", MARGIN, y, "F2", 10, TEAL);
    y -= 22;
  }
  text("BOOKING REFERENCE", MARGIN, y, "F2", 9, TEAL);
  y -= 30;
  text(view.reference, MARGIN, y, "F3", 28, NAVY);
  y -= 18;
  rect(MARGIN, y, PAGE_W - 2 * MARGIN, 1, rgb(220, 230, 238));
  y -= 24;

  const valueX = MARGIN + 92;
  const valueWidth = PAGE_W - MARGIN - valueX;
  const row = (label: string, value: string, sub?: string) => {
    text(label, MARGIN, y, "F1", 10, MUTED);
    const lines = wrap(value, 12, valueWidth);
    lines.forEach((line, index) => text(line, valueX, y - index * 15, "F2", 12, INK));
    y -= (lines.length - 1) * 15;
    if (sub) {
      y -= 14;
      text(sub, valueX, y, "F1", 10, MUTED);
    }
    y -= 26;
  };

  row("Patient", view.patientNameMasked);
  row("Mobile", view.mobileMasked);
  row("Doctor", view.doctor.fullName, view.doctor.specialty);
  row("Department", view.department.name);
  row("Date", formatLocalDate(view.localDate));
  row("Time", `${view.localTime} (${zoneLabel(view.timeZone)})`);
  row("Fee", `${formatPkr(view.feePkr)} (sample)`);

  if (clinic.address.length > 0 || clinic.phoneDisplay !== "") {
    rect(MARGIN, y + 12, PAGE_W - 2 * MARGIN, 1, rgb(220, 230, 238));
    y -= 10;
    text("Clinic", MARGIN, y, "F1", 10, MUTED);
    const lines = [...clinic.address.flatMap((line) => wrap(line, 11, valueWidth)), ...(clinic.phoneDisplay !== "" ? [clinic.phoneDisplay] : [])];
    lines.forEach((line, index) => text(line, valueX, y - index * 14, index === lines.length - 1 && clinic.phoneDisplay !== "" ? "F2" : "F1", 11, INK));
    y -= lines.length * 14;
  }

  text("Show this reference at the clinic.", MARGIN, 60, "F2", 11, NAVY);
  text("This is a demo booking. No one will contact you.", MARGIN, 44, "F1", 10, MUTED);

  const content = ops.join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Resources << /Font << /F1 5 0 R /F2 6 0 R /F3 7 0 R >> >> /Contents 4 0 R >>`,
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Courier-Bold /Encoding /WinAnsiEncoding >>",
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
