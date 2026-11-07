// Feature 009: the four specialty presets and the switcher.
import { existsSync } from "node:fs";
import { join } from "node:path";

import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PresetSwitcher } from "@/components/presets/PresetSwitcher";
import { getManifestEntry } from "@/lib/pages";
import { DEFAULT_PRESET, PRESETS, PRESET_IDS, SAMPLE_EMAIL, SAMPLE_PHONE, getPreset, isPresetId, monogram, presetPath } from "@/presets/specialties";

// Words the constitution's honesty gate forbids (principle I).
const BANNED = /\b(rated|rating|award|accredited|JCI|ISO-certified|best in|no\. ?1|#1|five[- ]star|5[- ]star)\b/i;

describe("specialty presets", () => {
  it("has exactly the four presets, in switcher order, with unique names", () => {
    expect(PRESETS.map((p) => p.id)).toEqual([...PRESET_IDS]);
    expect(new Set(PRESETS.map((p) => p.clinicName)).size).toBe(4);
    expect(new Set(PRESETS.map((p) => p.label)).size).toBe(4);
    expect(getPreset(DEFAULT_PRESET)?.label).toBe("Multi-speciality");
  });

  it.each(PRESETS.map((p) => [p.id, p] as const))("%s has 4-6 services, 3 doctors and an existing hero image", (_id, preset) => {
    expect(preset.services.length).toBeGreaterThanOrEqual(4);
    expect(preset.services.length).toBeLessThanOrEqual(6);
    expect(preset.doctors).toHaveLength(3);
    expect(existsSync(join(process.cwd(), "public", preset.heroImage.src))).toBe(true);
    expect(preset.heroImage.alt.length).toBeGreaterThan(5);
    for (const service of preset.services) expect(service.price).toMatch(/PKR/);
  });

  it("uses no honesty-banned words and only the sample contact details", () => {
    const text = JSON.stringify(PRESETS);
    expect(text).not.toMatch(BANNED);
    expect(text).not.toMatch(/@(?!example\.com)[a-z0-9-]+\.[a-z]/i);
    expect(SAMPLE_EMAIL).toBe("test@example.com");
    expect(SAMPLE_PHONE).toBe("0300 1234567");
  });

  it("validates ids and builds monograms without titles", () => {
    expect(isPresetId("dental")).toBe(true);
    expect(isPresetId("cardiac")).toBe(false);
    expect(getPreset("cardiac")).toBeUndefined();
    expect(monogram("Pearl Dental Studio")).toBe("PS");
    expect(monogram("Dr. Hira Saleem")).toBe("HS");
    expect(monogram("Ms. Areeba Khan")).toBe("AK");
  });

  it("every preset page is in the manifest, out of the sitemap", () => {
    for (const id of PRESET_IDS) {
      const entry = getManifestEntry(presetPath(id));
      expect(entry.inSitemap).toBe(false);
    }
    expect(getManifestEntry("/demo/specialties").inSitemap).toBe(false);
  });
});

describe("PresetSwitcher", () => {
  it("is a navigation of four links with the current one marked", () => {
    render(<PresetSwitcher current="dental" />);
    const nav = screen.getByRole("navigation", { name: "Choose your specialty" });
    const links = within(nav).getAllByRole("link");
    expect(links.map((link) => link.textContent)).toEqual(["Dental", "Skin & Aesthetic", "Diagnostic Lab", "Multi-speciality"]);
    expect(within(nav).getByRole("link", { name: "Dental" })).toHaveAttribute("aria-current", "page");
    expect(within(nav).getByRole("link", { name: "Diagnostic Lab" })).not.toHaveAttribute("aria-current");
    expect(within(nav).getByRole("link", { name: "Skin & Aesthetic" })).toHaveAttribute("href", "/demo/specialties/skin-aesthetic");
  });
});
