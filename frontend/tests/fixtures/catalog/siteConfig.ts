import type { SiteConfig } from "@/types/content";

/**
 * Sample site details. Phone numbers are invalid on purpose: national numbers
 * never start with 0 after the country code, so they cannot reach a real
 * subscriber. Nothing here is a real clinic.
 */
export const siteConfig: SiteConfig = {
  name: "Shuaib Health",
  tagline: "Clinic & Diagnostics, Karachi",
  fullTitle: "Shuaib Health — Clinic & Diagnostics, Karachi",
  demoNotice: "Portfolio demo — not a real clinic, not medical advice.",
  emergencyPhone: { display: "+92 21 0000 0000", tel: "+922100000000" },
  generalPhone: { display: "+92 21 0000 0001", tel: "+922100000001" },
  address: ["Sample Road", "Karachi, Pakistan"],
  timeZone: "Asia/Karachi",
  openingHours: [{ days: ["mon", "tue", "wed", "thu", "fri", "sat"], opens: "09:00", closes: "21:00" }],
  // Sample lab hours; sample collection ends when the lab closes.
  labHours: [{ days: ["mon", "tue", "wed", "thu", "fri", "sat"], opens: "08:00", closes: "20:00" }],
  // Bounding box of the general Karachi area shown on the Contact page map. No marker is placed.
  mapArea: { bbox: [66.95, 24.78, 67.2, 24.96], label: "General area of Karachi" },
  credit: {
    text: "Designed & built by Shuaib Ali",
    href: "https://github.com/Shuaibali0786",
  },
  indexable: false,
  isSample: true,
};
