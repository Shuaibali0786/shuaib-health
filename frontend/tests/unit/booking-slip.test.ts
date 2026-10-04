import { describe, expect, it } from "vitest";

import { arriveByTime } from "@/lib/booking/labels";
import { formatBookedOn, buildCalendarIcs, buildSlipPdf, slipFileName, whatsappLink, whatsappText, type SlipClinic } from "@/lib/booking/slip";
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

const FORBIDDEN = /Ali Khan|03001234567|0300 ?1234567|ali@example\.com|chest pain/i;

function pdfText(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => String.fromCharCode(b)).join("");
}

describe("slip PDF", () => {
  const pdf = pdfText(buildSlipPdf(view, clinic));

  it("is a well-formed one-page PDF whose xref offsets are exact", () => {
    expect(pdf.startsWith("%PDF-1.4")).toBe(true);
    expect(pdf.trimEnd().endsWith("%%EOF")).toBe(true);
    const startxref = Number(/startxref\n(\d+)\n/.exec(pdf)?.[1]);
    expect(pdf.slice(startxref, startxref + 4)).toBe("xref");
    const entries = [...pdf.slice(startxref).matchAll(/^(\d{10}) 00000 n $/gm)].map((m) => Number(m[1]));
    expect(entries).toHaveLength(7);
    entries.forEach((offset, index) => expect(pdf.slice(offset, offset + 7)).toBe(`${index + 1} 0 obj`));
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
    const odd = pdfText(buildSlipPdf({ ...view, doctor: { ...view.doctor, fullName: "Dr. (A) \\ Zoë 医" } }, clinic));
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
  const pdf = pdfText(buildSlipPdf(view, clinic));

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
      "Please arrive by 13:45",
      "CONFIRMED",
      "04 Oct 2026",
      "DEMO",
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
    const quiet = pdfText(buildSlipPdf(view, { ...clinic, emergencyDisplay: undefined }));
    expect(quiet).not.toContain("Emergency?");
  });

  it("draws the QR for the reference as filled squares", () => {
    expect(pdf.match(/ re f/g)?.length).toBeGreaterThan(60);
  });
});
