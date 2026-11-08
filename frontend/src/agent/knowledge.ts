// Builds the assistant's knowledge pack on the server from the same cached loaders the pages use
// (Feature 010). Only public, allow-listed fields are copied; there is no patient, booking or staff data
// in the catalog to begin with, and this file never reads any.

import { getDepartments, getDoctors, getFaqGroups, getHealthPackages, getLabTests, getSiteConfig } from "@/lib/content";
import { isDemoEnabled } from "@/lib/demo";
import { formatOpeningHoursParts } from "@/lib/format";
import type { Department, Doctor, FaqGroup, HealthPackage, LabTest, SiteConfig } from "@/types/content";

import type { KnowledgePack } from "./types";

const hoursText = (rules: SiteConfig["openingHours"]) => {
  if (!rules.length) return "see the contact page";
  const { days, times } = formatOpeningHoursParts(rules);
  return `${days}, ${times}`;
};

/**
 * Public emergency numbers by the clinic's time zone (white-label: each client's own country). Unknown zones
 * get a neutral phrase rather than a wrong number.
 */
const EMERGENCY_BY_ZONE: Record<string, string> = {
  "Asia/Karachi": "1122 or 115",
  "Asia/Dubai": "998 (ambulance) or 999",
  "Asia/Riyadh": "997 (ambulance) or 911",
  "Asia/Qatar": "999",
  "Asia/Bahrain": "999",
  "Asia/Muscat": "9999",
  "Asia/Kuwait": "112",
  "Europe/London": "999 or 112",
};
export const emergencyNumbersFor = (timeZone: string) => EMERGENCY_BY_ZONE[timeZone] ?? "your local emergency number";

export function buildKnowledgePack(input: {
  site: SiteConfig;
  departments: Department[];
  doctors: Doctor[];
  labTests: LabTest[];
  packages: HealthPackage[];
  faqGroups: FaqGroup[];
  demo: boolean;
}): KnowledgePack {
  const deptById = new Map(input.departments.map((d) => [d.id, d]));
  return {
    clinic: {
      name: input.site.name,
      phone: input.site.generalPhone.display,
      emergencyPhone: input.site.emergencyPhone.display,
      emergencyNumbers: emergencyNumbersFor(input.site.timeZone),
      address: [...input.site.address],
      hours: hoursText(input.site.openingHours),
      labHours: hoursText(input.site.labHours),
      openingRules: input.site.openingHours.map((rule) => ({ days: [...rule.days], opens: rule.opens, closes: rule.closes })),
      timeZone: input.site.timeZone,
    },
    departments: input.departments.map((d) => ({ slug: d.slug, name: d.name, summary: d.summary })),
    doctors: input.doctors.map((d) => {
      const dept = deptById.get(d.departmentId);
      return {
        slug: d.slug,
        name: d.fullName,
        specialty: d.specialty,
        departmentSlug: dept?.slug ?? "",
        departmentName: dept?.name ?? "",
        feePkr: d.feePkr,
        days: [...new Set(d.schedule.map((s) => s.day))],
      };
    }),
    labTests: input.labTests.map((t) => ({
      slug: t.slug,
      name: t.name,
      aka: [...t.alsoKnownAs],
      pricePkr: t.pricePkr,
      sampleType: t.sampleType,
      reportTime: t.reportTime,
      preparation: t.preparation,
      homeCollection: t.homeCollection,
    })),
    packages: input.packages.map((p) => ({ slug: p.slug, name: p.name, pricePkr: p.packagePricePkr, whoFor: p.whoFor, preparation: p.preparation })),
    faqs: input.faqGroups.flatMap((g) => g.items.map((item) => ({ question: item.question, answer: item.answer, groupSlug: g.slug }))),
    demo: input.demo,
  };
}

/** The pack for the site layout. Any loader that fails gives an empty list (the engine then says it doesn't know). */
export async function loadKnowledgePack(): Promise<KnowledgePack> {
  const safe = <T,>(p: Promise<T[]>) => p.catch(() => [] as T[]);
  const [site, departments, doctors, labTests, packages, faqGroups] = await Promise.all([
    getSiteConfig(),
    safe(getDepartments()),
    safe(getDoctors()),
    safe(getLabTests()),
    safe(getHealthPackages()),
    safe(getFaqGroups()),
  ]);
  return buildKnowledgePack({ site, departments, doctors, labTests, packages, faqGroups, demo: isDemoEnabled() });
}
