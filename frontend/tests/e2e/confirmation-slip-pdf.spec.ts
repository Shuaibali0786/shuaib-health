import { readFileSync } from "node:fs";
import { join } from "node:path";

import { expect, test } from "@playwright/test";

import type { AppointmentView } from "@/lib/booking/schemas";
import { buildSlipPdf, type SlipClinic } from "@/lib/booking/slip";
import { SLIP_FONT_KEYS, SLIP_FONT_METRICS, type SlipFonts } from "@/lib/booking/slip-fonts";

import { renderPdf } from "./helpers/pdf-render";

// The downloaded PDF, drawn by pdf.js exactly as a reader would (no server needed), from a fixed booking so
// the picture is stable. It is the same design as the page: double-ring stamp, navy pill, brand fonts, faint watermark.
const view: AppointmentView = {
  reference: "ABCDE-FGHJK",
  status: "confirmed",
  doctor: { slug: "dr-imran-qureshi", fullName: "Dr. Imran Qureshi", specialty: "Cardiology" },
  department: { slug: "cardiology", name: "Cardiology" },
  startsAt: "2026-10-14T09:00:00Z",
  endsAt: "2026-10-14T09:15:00Z",
  localDate: "2026-10-14",
  localTime: "14:00",
  timeZone: "Asia/Karachi",
  feePkr: 2500,
  patientNameMasked: "A**** K****",
  mobileMasked: "0300****567",
  bookedAt: "2026-10-07T09:05:00Z",
  isSample: true,
};
const clinic: SlipClinic = { name: "Shuaib Health", address: ["12 Example Road", "Karachi"], phoneDisplay: "+92 21 111 000 111", phoneTel: "+9221111000111", emergencyDisplay: "1122" };
const fonts = Object.fromEntries(SLIP_FONT_KEYS.map((key) => [key, new Uint8Array(readFileSync(join(process.cwd(), "public", "fonts", "slip", SLIP_FONT_METRICS[key].file)))])) as SlipFonts;

test.describe("slip PDF as a reader draws it", () => {
  test("uses the embedded brand fonts everywhere, never a serif fallback, and looks like the baseline", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "the PDF does not depend on the screen: drawn once");
    const rendered = await renderPdf(page, buildSlipPdf(view, clinic, fonts));
    expect(rendered.pages).toBe(1);
    const names = rendered.fonts.map((font) => font.name).filter(Boolean);
    expect(names.length).toBeGreaterThanOrEqual(3);
    for (const font of rendered.fonts) expect(font.embedded, font.name).toBe(true);
    for (const name of names) expect(name).toMatch(/Inter|PlusJakartaSans/);
    expect(names.join(" ")).not.toMatch(/Times|Helvetica|serif/i);
    expect(rendered.png.length).toBeGreaterThan(20_000);
    expect(rendered.png).toMatchSnapshot("slip-pdf.png", { maxDiffPixelRatio: 0.002 });
  });
});
