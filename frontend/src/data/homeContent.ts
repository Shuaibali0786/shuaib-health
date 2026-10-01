import { formatOpeningHours, formatOpeningHoursParts } from "@/lib/format";
import type { Fact, HeroFact, ImageAsset, QuickAction, WhyPoint } from "@/types/content";
import { departments } from "./departments";
import { siteConfig } from "./siteConfig";

/**
 * Static home-page copy (not API-shaped). Only honest, demo-true statements:
 * no counts of patients, years, awards, certifications, ratings or comparisons.
 */

const hoursParts = formatOpeningHoursParts(siteConfig.openingHours);

/** Hero photo (4:5), fitted from a stock photo with npm run images. */
export const heroImage: ImageAsset = {
  src: "/images/hero/hero-doctor-placeholder.jpg",
  alt: "Smiling doctor in a white coat with a stethoscope, seated at a desk",
  width: 1200,
  height: 1500,
};

/** Exactly three floating cards in the hero (FR-011). */
export const heroFacts: HeroFact[] = [
  { id: "hours", label: `Open ${formatOpeningHours(siteConfig.openingHours)}`, iconName: "clock" },
  { id: "reports", label: "Lab reports online", iconName: "file-text" },
  { id: "home-sample", label: "Home sample collection", iconName: "house" },
];

/** "How can we help you?" actions, in the order required by FR-012. */
export const quickActions: QuickAction[] = [
  {
    id: "find-doctor",
    label: "Find a Doctor",
    description: "Browse our doctors and their fees.",
    href: "/doctors",
    iconName: "stethoscope",
  },
  {
    id: "book-appointment",
    label: "Book Appointment",
    description: "Choose a doctor and a time.",
    href: "/book-appointment",
    iconName: "calendar-check",
  },
  {
    id: "lab-tests",
    label: "Lab Tests",
    description: "See the tests we offer.",
    href: "/lab-tests",
    iconName: "flask-conical",
  },
  {
    id: "health-packages",
    label: "Health Packages",
    description: "Checkups bundled into one visit.",
    href: "/health-packages",
    iconName: "package",
  },
  {
    id: "home-sample-collection",
    label: "Home Sample Collection",
    description: "Give a sample at home.",
    href: "/home-sample-collection",
    iconName: "house",
  },
];

/** The honest facts band (FR-014): exactly four facts that are true within the demo. */
export const facts: Fact[] = [
  { id: "departments", value: String(departments.length), label: "Departments" },
  { id: "reports", value: "Online", label: "Lab reports" },
  { id: "hours", value: hoursParts.days, label: hoursParts.times },
  { id: "same-day", value: "Same day", label: "Reports for common tests" },
];

/** "Why choose us" points (FR-015): no superlatives, comparisons or numbers. */
export const whyPoints: WhyPoint[] = [
  {
    id: "simple-booking",
    title: "Simple appointment booking",
    text: "Choose a doctor and a time that works for you.",
    iconName: "calendar-check",
  },
  {
    id: "clinic-and-lab",
    title: "Clinic and lab together",
    text: "See a doctor and get your tests done in the same place.",
    iconName: "flask-conical",
  },
  {
    id: "reports-online",
    title: "Reports online",
    text: "View your lab reports online when they are ready.",
    iconName: "file-text",
  },
  {
    id: "home-samples",
    title: "Home sample collection",
    text: "Give a sample at home for common tests.",
    iconName: "house",
  },
  {
    id: "clear-fees",
    title: "Clear consultation fees",
    text: "See each doctor's fee in PKR before you book.",
    iconName: "receipt",
  },
];
