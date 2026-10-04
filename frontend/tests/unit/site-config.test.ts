// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";
import clinicJson from "../fixtures/api/clinic.json";
import clinicRulesJson from "../fixtures/api/clinic-rules.json";
import { CREDIT, DEMO_NOTICE } from "@/lib/honesty";

// `getSiteConfig()` precedence (data-model §5): the live or last-good API value, else a valid
// CLINIC_FALLBACK_JSON, else the neutral identity. The loaders are replaced so each case controls
// what the API step returns.
const loaders = vi.hoisted(() => ({
  cachedClinic: vi.fn(),
  cachedClinicRules: vi.fn(),
}));
vi.mock("@/lib/api/cached", () => ({
  ...loaders,
  cachedDepartments: vi.fn(),
  cachedDoctors: vi.fn(),
  cachedHealthPackages: vi.fn(),
  cachedLabTestCategories: vi.fn(),
  cachedLabTests: vi.fn(),
}));

import { getClinicRules, getSiteConfig } from "@/lib/content";

const apiClinic = { ...clinicJson, name: "Live Clinic", fullTitle: "Live Clinic - Test" };
const fallbackClinic = { ...clinicJson, name: "Fallback Clinic", fullTitle: "Fallback Clinic - Test" };

let warn: MockInstance<typeof console.warn>;

beforeEach(() => {
  loaders.cachedClinic.mockReset();
  loaders.cachedClinicRules.mockReset();
  warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.stubEnv("CLINIC_FALLBACK_JSON", "");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("getSiteConfig", () => {
  it("uses the API values when the API answers", async () => {
    loaders.cachedClinic.mockResolvedValue(apiClinic);
    vi.stubEnv("CLINIC_FALLBACK_JSON", JSON.stringify(fallbackClinic));
    const site = await getSiteConfig();
    expect(site.name).toBe("Live Clinic");
    expect(site.emergencyPhone).toEqual(clinicJson.emergencyPhone);
    expect(site.mapArea.bbox).toEqual(clinicJson.mapArea.bbox);
  });

  it("falls back to CLINIC_FALLBACK_JSON when the API fails and nothing was ever loaded", async () => {
    loaders.cachedClinic.mockRejectedValue(new Error("down"));
    vi.stubEnv("CLINIC_FALLBACK_JSON", JSON.stringify(fallbackClinic));
    const site = await getSiteConfig();
    expect(site.name).toBe("Fallback Clinic");
    expect(site.emergencyPhone.tel).toBe(clinicJson.emergencyPhone.tel);
  });

  it("uses the neutral identity, with one warning for the invalid fallback, when nothing else is valid", async () => {
    loaders.cachedClinic.mockRejectedValue(new Error("down"));
    vi.stubEnv("CLINIC_FALLBACK_JSON", '{"name":"not enough"}');
    warn.mockClear();
    const site = await getSiteConfig();
    expect(site.name).toBe("Clinic");
    expect(site.emergencyPhone).toEqual({ display: "", tel: "" });
    expect(site.generalPhone).toEqual({ display: "", tel: "" });
    expect(site.address).toEqual([]);
    expect(site.openingHours).toEqual([]);
    expect(site.demoNotice).toBe(DEMO_NOTICE);
    expect(site.credit).toEqual(CREDIT);
    // One line from the failed API load and one from the invalid fallback.
    const messages = warn.mock.calls.map((call) => String(call[0]));
    expect(messages.filter((message) => message.includes("CLINIC_FALLBACK_JSON"))).toHaveLength(1);
    expect(messages.some((message) => message.includes("not enough"))).toBe(false);
  });

  it("uses the neutral identity when there is no fallback at all", async () => {
    loaders.cachedClinic.mockRejectedValue(new Error("down"));
    const site = await getSiteConfig();
    expect(site.name).toBe("Clinic");
    expect(site.demoNotice).toBe(DEMO_NOTICE);
  });

  it("never replaces live data with the fallback: last good data is served when a refresh fails", async () => {
    // unstable_cache hands back the last good value when a refresh throws, so the loader resolves.
    vi.stubEnv("CLINIC_FALLBACK_JSON", JSON.stringify(fallbackClinic));
    loaders.cachedClinic.mockResolvedValueOnce(apiClinic).mockResolvedValueOnce(apiClinic);
    expect((await getSiteConfig()).name).toBe("Live Clinic");
    expect((await getSiteConfig()).name).toBe("Live Clinic");
  });

  it("always takes the demo notice and credit from the constitution constants, whatever the data says", async () => {
    loaders.cachedClinic.mockResolvedValue({ ...apiClinic, demoNotice: "Totally real.", credit: { text: "Someone", href: "https://example.test/" } });
    const site = await getSiteConfig();
    expect(site.demoNotice).toBe(DEMO_NOTICE);
    expect(site.credit).toEqual(CREDIT);
  });
});

describe("getClinicRules", () => {
  it("returns the rules sorted by sortOrder", async () => {
    loaders.cachedClinicRules.mockResolvedValue([...clinicRulesJson.items].reverse());
    const rules = await getClinicRules();
    expect(rules.map((rule) => rule.sortOrder)).toEqual(clinicRulesJson.items.map((rule) => rule.sortOrder).sort((a, b) => a - b));
    expect(rules).toHaveLength(clinicRulesJson.items.length);
  });

  it("returns an empty list when the API is unavailable", async () => {
    loaders.cachedClinicRules.mockRejectedValue(new Error("down"));
    expect(await getClinicRules()).toEqual([]);
  });

  it("returns an empty list when the clinic has no rules", async () => {
    loaders.cachedClinicRules.mockResolvedValue([]);
    expect(await getClinicRules()).toEqual([]);
  });
});
