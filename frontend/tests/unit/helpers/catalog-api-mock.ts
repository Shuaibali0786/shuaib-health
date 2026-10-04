// Stand-in for `@/lib/api/cached` in unit tests: serves the sample catalog fixtures so content
// accessors and server components can run without Next's data cache or a network.
// Use it as: vi.mock("@/lib/api/cached", async () => (await import("./helpers/catalog-api-mock")).catalogApiMock);
import clinicRulesJson from "../../fixtures/api/clinic-rules.json";
import { departments } from "../../fixtures/catalog/departments";
import { doctors } from "../../fixtures/catalog/doctors";
import { healthPackages } from "../../fixtures/catalog/healthPackages";
import { labTestCategories, labTests } from "../../fixtures/catalog/labTests";
import { siteConfig } from "../../fixtures/catalog/siteConfig";

/**
 * What the mocked clinic loader does. Tests set it and put it back to "ok" in `beforeEach`:
 * - "ok": the sample clinic;
 * - "down": the loader throws, so `getSiteConfig()` falls through to the neutral identity;
 * - "other-honesty": the data carries a different demo notice and credit than the constitution text.
 */
export const clinicState: { mode: "ok" | "down" | "other-honesty" } = { mode: "ok" };

const clinic = {
  ...siteConfig,
  logo: { src: "/images/brand/logo-mark.svg", alt: "Logo", width: 64, height: 64 },
  brandColors: { primary: "#0B2545", accent: "#14B8A6" },
};

export const catalogApiMock = {
  CATALOG_REVALIDATE: 300,
  cachedClinic: async () => {
    if (clinicState.mode === "down") throw new Error("clinic unavailable");
    if (clinicState.mode === "other-honesty") {
      return { ...clinic, demoNotice: "Totally real clinic.", credit: { text: "Someone else", href: "https://example.test/" } };
    }
    return clinic;
  },
  cachedClinicRules: async () => clinicRulesJson.items,
  cachedDepartments: async () => departments,
  cachedDoctors: async () => doctors,
  cachedLabTestCategories: async () => labTestCategories,
  cachedLabTests: async () => labTests,
  cachedHealthPackages: async () => healthPackages,
};
