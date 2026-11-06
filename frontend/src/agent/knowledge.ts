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
      address: [...input.site.address],
      hours: hoursText(input.site.openingHours),
      labHours: hoursText(input.site.labHours),
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
