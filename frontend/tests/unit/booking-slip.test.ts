import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { SEAL, sealContent, sealExtents } from "@/lib/booking/seal";
import { arriveByTime } from "@/lib/booking/labels";
import { formatBookedOn, buildCalendarIcs, buildSlipPdf, slipFileName, type SlipClinic } from "@/lib/booking/slip";
import { SLIP_FONT_KEYS, SLIP_FONT_METRICS, type SlipFonts } from "@/lib/booking/slip-fonts";
import { whatsappLink, whatsappText } from "@/lib/booking/whatsapp";
import type { AppointmentView } from "@/lib/booking/schemas";

const view: AppointmentView = {
  reference: "ABCDE-FGHJK",
  status: "confirmed",
  doctor: { slug: "dr-imran-qureshi", fullName: "Dr. Imran Qureshi", specialty: "Cardiology" },
  department: { slug: "cardiology", name: "Cardiology" },
  startsAt: "2026-10-06T09:00:00Z",
  endsAt: "2026-10-06T09:15:00Z",
  localDate: "2026-10-06",
  localTime: "14:00",
  timeZone: "Asia/Karachi",
  feePkr: 2500,
  patientNameMasked: "A**** K****",
  mobileMasked: "0300****567",
  bookedAt: "2026-10-04T09:05:00Z",
  isSample: true,
};

const clinic: SlipClinic = {
  name: "Shuaib Health",
  address: ["12 Example Road", "Karachi"],
  phoneDisplay: "+92 21 111 000 111",
  phoneTel: "+9221111000111",
  emergencyDisplay: "1122",
};

/** The font files the page serves from /fonts/slip, read from disk. */
const fonts = Object.fromEntries(SLIP_FONT_KEYS.map((key) => [key, new Uint8Array(readFileSync(join(process.cwd(), "public", "fonts", "slip", SLIP_FONT_METRICS[key].file)))])) as SlipFonts;

// The slip's page geometry (points): 420 wide, 595 + the 40 the appointment box gained, 30 margins.
const PAGE_WIDTH = 420;
const PAGE_HEIGHT = 635;
const MARGIN = 30;
const DETAILS_TOP = 242; // "VISIT DETAILS" heading
const DETAILS_BOTTOM = 414; // top of the "Before you come" box
const QR_FRAME_TOP = 501; // perforation at 492, QR frame 9 below it

const FORBIDDEN = /Ali Khan|03001234567|0300 ?1234567|ali@example\.com|chest pain/i;

function pdfText(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => String.fromCharCode(b)).join("");
}

describe("slip PDF", () => {
  const pdf = pdfText(buildSlipPdf(view, clinic, fonts));

  it("is a well-formed one-page PDF whose xref offsets are exact", () => {
    expect(pdf.startsWith("%PDF-1.4")).toBe(true);
    expect(pdf.trimEnd().endsWith("%%EOF")).toBe(true);
    const startxref = Number(/startxref\n(\d+)\n/.exec(pdf)?.[1]);
    expect(pdf.slice(startxref, startxref + 4)).toBe("xref");
    const entries = [...pdf.slice(startxref).matchAll(/^(\d{10}) 00000 n $/gm)].map((m) => Number(m[1]));
    expect(entries).toHaveLength(14);
    entries.forEach((offset, index) => expect(pdf.slice(offset, offset + `${index + 1} 0 obj`.length)).toBe(`${index + 1} 0 obj`));
    const length = Number(/\/Length (\d+)/.exec(pdf)?.[1]);
    const stream = pdf.slice(pdf.indexOf("stream\n") + 7, pdf.indexOf("\nendstream"));
    expect(stream.length).toBe(length);
  });

  it("shows the reference, doctor, date, time, fee, clinic details and the masked patient", () => {
    for (const expected of [
      "ABCDE-FGHJK",
      "Dr. Imran Qureshi",
      "Tue 6 Oct",
      "14:00 \\(PKT\\)", // parentheses are escaped inside PDF strings
      "PKR 2,500",
      "12 Example Road",
      "+92 21 111 000 111",
      "A**** K****",
      "0300****567",
    ]) {
      expect(pdf).toContain(expected);
    }
  });

  it("never contains unmasked patient details", () => {
    expect(pdf).not.toMatch(FORBIDDEN);
  });

  it("escapes PDF string syntax and replaces characters outside Latin-1", () => {
    const odd = pdfText(buildSlipPdf({ ...view, doctor: { ...view.doctor, fullName: "Dr. (A) \\ Zoë 医" } }, clinic, fonts));
    expect(odd).toContain("Dr. \\(A\\) \\\\ Zoë ?");
  });

  it("names the file after the reference", () => {
    expect(slipFileName(view)).toBe("appointment-slip-ABCDE-FGHJK.pdf");
  });
});

describe("calendar file", () => {
  const raw = buildCalendarIcs(view, clinic, new Date("2026-10-05T00:00:00Z"));
  const ics = raw.replaceAll("\r\n ", ""); // unfolded

  it("uses CRLF lines and Pakistan time", () => {
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(ics).toContain("TZID:Asia/Karachi");
    expect(ics).toContain("TZOFFSETTO:+0500");
    expect(ics).toContain("DTSTART;TZID=Asia/Karachi:20261006T140000");
    expect(ics).toContain("DTEND;TZID=Asia/Karachi:20261006T141500");
    expect(ics).toContain("DTSTAMP:20261005T000000Z");
  });

  it("describes the visit and escapes text", () => {
    expect(ics).toContain("SUMMARY:Appointment with Dr. Imran Qureshi");
    expect(ics).toContain("LOCATION:12 Example Road\\, Karachi");
    expect(ics).toContain("Booking reference: ABCDE-FGHJK\\nDoctor: Dr. Imran Qureshi\\nClinic phone: +92 21 111 000 111");
  });

  it("never exceeds 75 octets per line and carries no patient data", () => {
    for (const line of raw.split("\r\n")) expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
    expect(ics).not.toMatch(FORBIDDEN);
    expect(ics).not.toContain("****");
  });

  it("falls back to UTC for a zone other than Karachi", () => {
    const other = buildCalendarIcs({ ...view, timeZone: "Europe/London" }, clinic, new Date("2026-10-05T00:00:00Z"));
    expect(other).toContain("DTSTART:20261006T090000Z");
    expect(other).not.toContain("VTIMEZONE");
  });
});

describe("WhatsApp message", () => {
  it("has the reference, doctor, date, time and clinic phone, and nothing about the patient", () => {
    const text = whatsappText(view, clinic);
    expect(text).toBe(
      ["Appointment booked at Shuaib Health", "Reference: ABCDE-FGHJK", "Doctor: Dr. Imran Qureshi", "Date: Tue 6 Oct", "Time: 14:00 (PKT)", "Clinic phone: +92 21 111 000 111"].join("\n"),
    );
    expect(text).not.toMatch(FORBIDDEN);
    expect(text).not.toContain("****");
  });

  it("builds a wa.me link with the text encoded", () => {
    const link = whatsappLink(view, clinic);
    expect(link.startsWith("https://wa.me/?text=")).toBe(true);
    expect(decodeURIComponent(link.slice("https://wa.me/?text=".length))).toBe(whatsappText(view, clinic));
  });
});

describe("luxury slip (FR-057a)", () => {
  const pdf = pdfText(buildSlipPdf(view, clinic, fonts));

  it("computes arrive-by as the appointment time minus 15 minutes, wrapping past midnight", () => {
    expect(arriveByTime("14:00")).toBe("13:45");
    expect(arriveByTime("09:10")).toBe("08:55");
    expect(arriveByTime("00:05")).toBe("23:50");
  });

  it("formats the booking time in the clinic zone", () => {
    expect(formatBookedOn("2026-10-04T09:05:00Z", "Asia/Karachi")).toBe("4 Oct 2026, 14:05 PKT");
  });

  it("carries the highlight box, seal, before-you-come box, QR label and footer", () => {
    for (const expected of [
      "Tue 6 Oct 2026",
      "Please arrive by ",
      "13:45",
      "CONFIRMED",
      "BOOKED 04 OCT",
      "Before you come",
      "Arrive 15 minutes early.",
      "Bring your CNIC and any previous reports.",
      "Emergency? Call 1122.",
      "Show at reception",
      "Booked on 4 Oct 2026, 14:05 PKT",
      "Demo booking, no one will contact you",
    ]) {
      expect(pdf).toContain(expected);
    }
  });

  it("leaves the emergency line out when the clinic has no emergency number", () => {
    const quiet = pdfText(buildSlipPdf(view, { ...clinic, emergencyDisplay: undefined }, fonts));
    expect(quiet).not.toContain("Emergency?");
  });

  it("draws the QR for the reference as filled squares", () => {
    expect(pdf.match(/ re f/g)?.length).toBeGreaterThan(60);
  });
});

describe("slip PDF fonts and stamp (the page and the PDF match)", () => {
  const pdf = pdfText(buildSlipPdf(view, clinic, fonts));
  const stream = pdf.slice(pdf.indexOf("stream\n") + 7, pdf.indexOf("\nendstream"));
  const ops = stream.split("\n");

  /** The first filled circle is the stamp's outer ring: its path gives the centre and radius. */
  function outerRing() {
    const ringOp = ops.find((op) => /^1 1 1 rg [\d. ]+ RG [\d.]+ w [\d.]+ [\d.]+ m .* c B$/.test(op)) ?? "";
    const n = ringOp.slice(ringOp.indexOf(" w ") + 3).match(/-?[\d.]+/g)!.map(Number);
    return { cx: n[6]!, cy: n[1]!, r: n[0]! - n[6]! };
  }

  it("embeds the website's brand fonts and uses no Times, Helvetica or other standard font", () => {
    expect(pdf.match(/\/FontFile2 \d+ 0 R/g)).toHaveLength(3);
    for (const name of ["Inter-Regular", "Inter-SemiBold", "PlusJakartaSans-Bold"]) expect(pdf).toContain(`/BaseFont /${name}`);
    expect(pdf).not.toMatch(/Times|Helvetica|Courier|\/Type1\b|Symbol/);
    for (const key of SLIP_FONT_KEYS) expect(pdf).toContain(`/Length1 ${fonts[key].length}`);
    // The embedded bytes are the font files themselves, not a stand-in.
    for (const key of SLIP_FONT_KEYS) expect(pdf).toContain(pdfText(fonts[key].subarray(0, 64)));
  });

  it("sets the name, date, time, Before you come and the reference in the heading font, the rest in Inter", () => {
    const fontOf = (value: string) => ops.find((op) => op.includes(`(${value})`))?.match(/\/(F\d) /)?.[1];
    for (const heading of ["Shuaib Health", "Tue 6 Oct 2026", "14:00 \\(PKT\\)", "Before you come", "ABCDE-FGHJK"]) expect(fontOf(heading), heading).toBe("F3");
    for (const body of ["Arrive 15 minutes early.", "Show at reception", "VISIT DETAILS"]) expect(["F1", "F2"], body).toContain(fontOf(body));
    const used = new Set(ops.flatMap((op) => [...op.matchAll(/\/(F\d) [\d.]+ Tf/g)].map((m) => m[1])));
    expect([...used].sort()).toEqual(["F1", "F2", "F3"]);
  });

  it("keeps the navy arrive-by pill, as on the page", () => {
    const pillAt = ops.findIndex((op) => /^0\.04 0\.15 0\.27 rg .* c f$/.test(op));
    expect(pillAt).toBeGreaterThan(-1);
    expect(ops[pillAt + 1]).toContain("(Please arrive by )");
    expect(ops[pillAt + 1]).toContain("1 1 1 rg"); // white text
    expect(ops[pillAt + 2]).toContain("(13:45)");
  });

  it("draws the watermark at the page's 4 % opacity", () => {
    expect(pdf).toMatch(/\/ExtGState << \/GS1 \d+ 0 R >>/);
    expect(pdf).toContain("/ca 0.04");
    expect(ops[ops.indexOf("q /GS1 gs") + 1]).toMatch(/ rg /);
  });

  it("keeps the watermark centred inside the visit-details band, clear of the header, stamp, QR and text blocks", () => {
    const start = ops.indexOf("q /GS1 gs");
    const fill = ops[start + 1] ?? ""; // the mark's filled outline (the stroke on top of it sits inside it)
    const numbers = fill
      .replace(/^.* rg /, "")
      .split(" ")
      .filter((token) => /^-?\d+(\.\d+)?$/.test(token))
      .map(Number);
    const xs = numbers.filter((_, i) => i % 2 === 0);
    const tops = numbers.filter((_, i) => i % 2 === 1).map((y) => PAGE_HEIGHT - y); // measured down from the top edge
    expect(xs.length).toBeGreaterThan(10);
    const [left, right, top, bottom] = [Math.min(...xs), Math.max(...xs), Math.min(...tops), Math.max(...tops)];
    expect((left + right) / 2).toBeCloseTo(PAGE_WIDTH / 2, 0); // centred across the page
    expect(left).toBeGreaterThan(MARGIN);
    expect(right).toBeLessThan(PAGE_WIDTH - MARGIN);
    expect(top).toBeGreaterThanOrEqual(DETAILS_TOP); // below the date box and its stamp and pill
    expect(bottom).toBeLessThanOrEqual(DETAILS_BOTTOM); // above "Before you come", the perforation and the QR
    expect(bottom).toBeLessThan(QR_FRAME_TOP);
  });

  it("keeps every character of the stamp inside its rings: arcs between them, the centre inside the inner ring", () => {
    const { cx, cy, r: outer } = outerRing();
    const k = outer / SEAL.outerRadius;
    const glyphs = ops
      .filter((op) => / Tm \(/.test(op))
      .map((op) => {
        const m = /\/(F\d) ([\d.]+) Tf .* (-?[\d.]+) (-?[\d.]+) (-?[\d.]+) (-?[\d.]+) (-?[\d.]+) (-?[\d.]+) Tm \((.*)\) Tj/.exec(op)!;
        return { font: m[1] as "F1" | "F2" | "F3", size: Number(m[2]), matrix: m.slice(3, 9).map(Number) as [number, number, number, number, number, number], text: m[9]! };
      });
    expect(glyphs.length).toBeGreaterThan(20);
    const centre = glyphs.filter((g) => g.text.length > 1 && g.text !== "\\(" && g.text !== "\\)");
    const arcs = glyphs.filter((g) => !centre.includes(g));
    expect(centre.map((g) => g.text)).toEqual(["CONFIRMED", "BOOKED 04 OCT"]);
    const radii = (g: (typeof glyphs)[number]) => {
      const metrics = SLIP_FONT_METRICS[g.font];
      const width = (g.text.split("").reduce((sum, c) => sum + (metrics.widths[c.charCodeAt(0) - 32] ?? 0), 0) * g.size) / 1000;
      const cap = (metrics.capHeight * g.size) / 1000;
      const [a, b, c, d, e, f] = g.matrix;
      return ([[0, 0], [width, 0], [width, cap], [0, cap]] as const).map(([x, y]) => Math.hypot(a * x + c * y + e - cx, b * x + d * y + f - cy) / k);
    };
    const clearance = 1.5; // box units between a glyph and a ring line
    for (const g of arcs) {
      for (const r of radii(g)) {
        expect(r, g.text).toBeGreaterThan(SEAL.innerRadius + SEAL.innerStroke / 2 + clearance);
        expect(r, g.text).toBeLessThan(SEAL.outerRadius - SEAL.outerStroke / 2 - clearance);
      }
    }
    for (const g of centre) for (const r of radii(g)) expect(r, g.text).toBeLessThan(SEAL.innerRadius - SEAL.innerStroke / 2 - SEAL.clearance);
  });

  it("keeps the stamp's text clear of both rings for a long clinic name, a short one and a non-demo booking", () => {
    for (const input of [
      { clinicName: "Shuaib Health", booked: "07 Oct", sample: true },
      { clinicName: "Shuaib Health Clinic & Diagnostic Centre, Karachi", booked: "30 Sep", sample: false },
      { clinicName: "WWW", booked: "28 Feb", sample: true },
    ]) {
      const { arcs, centre } = sealExtents(sealContent(input));
      expect(arcs[0], input.clinicName).toBeGreaterThan(SEAL.innerRadius + SEAL.innerStroke / 2 + 1.5);
      expect(arcs[1], input.clinicName).toBeLessThan(SEAL.outerRadius - SEAL.outerStroke / 2 - 1.5);
      expect(centre, input.clinicName).toBeLessThan(SEAL.innerRadius - SEAL.innerStroke / 2 - SEAL.clearance);
    }
  });

  it("puts the whole stamp inside the appointment box, clear of its border and above the pill", () => {
    const frameOp = ops.find((op) => / re B$/.test(op) && op.startsWith("0.94 0.99 0.98 rg")) ?? "";
    const [bx, by, bw, bh] = frameOp.match(/(-?[\d.]+) (-?[\d.]+) (-?[\d.]+) (-?[\d.]+) re B$/)!.slice(1).map(Number) as [number, number, number, number];
    const { cx, cy, r } = outerRing();
    expect(cx - r).toBeGreaterThan(bx + 10);
    expect(cx + r).toBeLessThan(bx + bw - 10);
    expect(cy + r).toBeLessThan(by + bh - 6);
    expect(cy - r).toBeGreaterThan(by + 6);
    // PDF y runs up: the pill's top edge is its bottom y plus its height, and it sits under the stamp's bottom edge.
    const pill = ops.find((op) => /^0\.04 0\.15 0\.27 rg .* c f$/.test(op))!;
    const pillBottom = Number(pill.match(/rg [\d.]+ ([\d.]+) m/)![1]);
    expect(pillBottom + 22).toBeLessThan(cy - r);
  });
});
