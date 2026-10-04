import type { HealthPackage } from "@/types/content";

type PackageInput = Omit<HealthPackage, "id" | "isSample">;

function healthPackage(input: PackageInput): HealthPackage {
  return { id: `pkg-${input.slug}`, ...input, isSample: true };
}

const FASTING = "10–12 hours fasting; plain water is allowed";

/**
 * Five sample packages, each a list of catalog test slugs plus a sample package price.
 * The sum of the individual tests is never stored: it is worked out from the catalog
 * (lib/packages.ts), so it cannot drift. Each package price is below that sum.
 * Preparation follows the strictest included test; home collection is true only when
 * every included test allows it (checked in tests/unit/packages.test.ts).
 */
export const healthPackages: HealthPackage[] = [
  healthPackage({
    slug: "basic-health-check",
    name: "Basic Health Check",
    iconName: "clipboard-check",
    whoFor: "Adults who want a general look at blood, sugar, cholesterol, liver, kidney and urine tests in one visit.",
    testSlugs: [
      "complete-blood-count",
      "fasting-blood-sugar",
      "lipid-profile",
      "liver-function-tests",
      "serum-creatinine",
      "urine-routine-examination",
    ],
    packagePricePkr: 4500,
    preparation: `${FASTING}. Bring a first-morning urine sample if you can.`,
    homeCollection: true,
  }),
  healthPackage({
    slug: "diabetes-care",
    name: "Diabetes Care",
    iconName: "candy",
    whoFor: "People who live with diabetes or are keeping an eye on their blood sugar, and want the usual tests together.",
    testSlugs: [
      "fasting-blood-sugar",
      "hba1c",
      "random-blood-sugar",
      "lipid-profile",
      "serum-creatinine",
      "urine-routine-examination",
    ],
    packagePricePkr: 4200,
    preparation: `${FASTING}. Ask your doctor before changing any medicine on the day.`,
    homeCollection: true,
  }),
  healthPackage({
    slug: "heart-check",
    name: "Heart Check",
    iconName: "heart-pulse",
    whoFor: "Adults who want heart-related blood tests along with sugar, kidney and blood count tests.",
    testSlugs: ["lipid-profile", "hs-crp", "fasting-blood-sugar", "serum-creatinine", "uric-acid", "complete-blood-count"],
    packagePricePkr: 5000,
    preparation: FASTING,
    homeCollection: true,
  }),
  healthPackage({
    slug: "womens-health",
    name: "Women's Health",
    iconName: "flower",
    whoFor: "Women who want a general check covering blood count, thyroid, vitamins and hormones.",
    testSlugs: ["complete-blood-count", "tsh", "vitamin-d", "vitamin-b12", "prolactin", "urine-routine-examination"],
    packagePricePkr: 9500,
    preparation: "No fasting needed. A morning sample is preferred; ask the lab about timing for the hormone test.",
    homeCollection: true,
  }),
  healthPackage({
    slug: "senior-citizen",
    name: "Senior Citizen",
    iconName: "hourglass",
    whoFor: "Older adults who want a wide set of routine tests together, so fewer visits are needed.",
    testSlugs: [
      "complete-blood-count",
      "fasting-blood-sugar",
      "hba1c",
      "lipid-profile",
      "liver-function-tests",
      "serum-creatinine",
      "uric-acid",
      "tsh",
      "vitamin-d",
      "urine-routine-examination",
    ],
    packagePricePkr: 10500,
    preparation: `${FASTING}. Home collection can be arranged for those who find travelling hard.`,
    homeCollection: true,
  }),
];
