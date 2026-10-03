import { departments } from "@/data/departments";
import { doctors } from "@/data/doctors";
import { healthTips } from "@/data/healthTips";
import { labTests } from "@/data/labTests";
import { siteConfig } from "@/data/siteConfig";
import { departmentPath, doctorPath, labTestPath, ROUTES, tipPath } from "@/lib/routes";
import type { PageManifestEntry } from "@/types/content";

/**
 * The page manifest: every public page with its title and description. Page metadata, the
 * sitemap and the link, title and description tests all read this one list, so "every page has a
 * unique title and description" and "the sitemap is complete" are checked from one place.
 * Titles are short; the layout appends " | Shuaib Health". Descriptions are 50-160 characters.
 */

const STATIC_PAGES: PageManifestEntry[] = [
  {
    path: ROUTES.home,
    title: siteConfig.fullTitle,
    description: "Find a doctor, see lab tests and health packages, and read health tips. Portfolio demo, not a real clinic.",
    kind: "static",
    inSitemap: true,
  },
  {
    path: ROUTES.about,
    title: "About",
    description: "The honest story of the Shuaib Health demo clinic: its mission, values and how a visit works, step by step.",
    kind: "static",
    inSitemap: true,
  },
  {
    path: ROUTES.doctors,
    title: "Doctors",
    description: "Browse nine sample doctors. Filter by department, name or the day they are available. Sample profiles only.",
    kind: "static",
    inSitemap: true,
  },
  {
    path: ROUTES.departments,
    title: "Departments",
    description: "Seven sample departments, from General Medicine to the Pathology Lab, with their doctors and related lab tests.",
    kind: "static",
    inSitemap: true,
  },
  {
    path: ROUTES.labTests,
    title: "Lab Tests",
    description: "Search the sample lab test catalog by name or category. Sample prices in PKR, report times and preparation.",
    kind: "static",
    inSitemap: true,
  },
  {
    path: ROUTES.healthPackages,
    title: "Health Packages",
    description: "Five sample health packages built from catalog tests, with the package price compared to the tests added up.",
    kind: "static",
    inSitemap: true,
  },
  {
    path: ROUTES.healthTips,
    title: "Health Tips",
    description: "Sample articles with general wellbeing information on nutrition, sleep, activity, hygiene and stress.",
    kind: "static",
    inSitemap: true,
  },
  {
    path: ROUTES.contact,
    title: "Contact",
    description: "Sample address, phone numbers and clinic and lab hours, plus a contact form that does not send messages in this demo.",
    kind: "static",
    inSitemap: true,
  },
  {
    path: ROUTES.faq,
    title: "FAQ",
    description: "Answers to common questions about appointments, lab tests and reports, payments, home sample collection and privacy.",
    kind: "static",
    inSitemap: true,
  },
  {
    path: ROUTES.privacy,
    title: "Privacy",
    description: "What data a real version of this app would collect and how it would be protected. A portfolio demo, not legal advice.",
    kind: "static",
    inSitemap: true,
  },
  {
    path: ROUTES.terms,
    title: "Terms",
    description: "Plain-language terms for using this portfolio demo site: sample content, no medical advice, no live bookings.",
    kind: "static",
    inSitemap: true,
  },
  {
    path: ROUTES.bookAppointment,
    title: "Booking coming soon",
    description: "Online appointment booking is not available in this demo yet. Browse the sample doctors and their schedules instead.",
    kind: "static",
    // A holding page, not content worth indexing.
    inSitemap: false,
  },
];

/** Every public page, in a stable order: static pages, then doctors, departments, lab tests and tips. */
export function getPageManifest(): PageManifestEntry[] {
  return [
    ...STATIC_PAGES,
    ...doctors.map((doctor): PageManifestEntry => ({
      path: doctorPath(doctor.slug),
      title: `${doctor.fullName} — ${doctor.specialty}`,
      description: `${doctor.fullName}, ${doctor.specialty}: qualifications, languages, fee and weekly schedule (sample profile).`,
      kind: "doctor",
      inSitemap: true,
    })),
    ...departments.map((department): PageManifestEntry => ({
      path: departmentPath(department.slug),
      title: `${department.name} department`,
      description: `${department.name} at Shuaib Health (sample): ${department.summary}`,
      kind: "department",
      inSitemap: true,
    })),
    ...labTests.map((test): PageManifestEntry => ({
      path: labTestPath(test.slug),
      title: `${test.name} — lab test`,
      description: `${test.name}: sample price, sample type, report time and preparation at the Shuaib Health demo lab.`,
      kind: "lab-test",
      inSitemap: true,
    })),
    ...healthTips.map((tip): PageManifestEntry => ({
      path: tipPath(tip.slug),
      title: tip.title,
      description: `${tip.summary} A sample health tip: general information, not medical advice.`,
      kind: "tip",
      inSitemap: true,
    })),
  ];
}

/** Every public path, from the manifest. */
export function knownPaths(): string[] {
  return getPageManifest().map((entry) => entry.path);
}

/** True for every path that has a real page. Ignores a #fragment, ?query and trailing slash. */
export function isKnownPath(path: string): boolean {
  const bare = path.split("#")[0]?.split("?")[0] ?? path;
  const target = bare.length > 1 ? bare.replace(/\/+$/, "") : bare;
  return knownPaths().includes(target);
}

/** The manifest entry for a path. Throws for an unknown path so a missing entry fails the build. */
export function getManifestEntry(path: string): PageManifestEntry {
  const entry = getPageManifest().find((candidate) => candidate.path === path);
  if (!entry) throw new Error(`No page manifest entry for ${path}`);
  return entry;
}
