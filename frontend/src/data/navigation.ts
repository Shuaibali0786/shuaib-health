import type { NavItem } from "@/types/content";

/** Header navigation, in the order required by the spec (FR-005). */
export const primaryNav: NavItem[] = [
  { label: "Home", href: "/" },
  { label: "About", href: "/about" },
  { label: "Doctors", href: "/doctors" },
  { label: "Departments", href: "/departments" },
  { label: "Lab Tests", href: "/lab-tests" },
  { label: "Health Packages", href: "/health-packages" },
  { label: "Health Tips", href: "/health-tips" },
  { label: "Contact", href: "/contact" },
];

/** Footer "Quick links" column. The Departments column is derived from the department data. */
export const footerQuickLinks: NavItem[] = [...primaryNav, { label: "Book Appointment", href: "/book-appointment" }];

/** Footer bottom row. */
export const legalLinks: NavItem[] = [
  { label: "Privacy", href: "/privacy" },
  { label: "Terms", href: "/terms" },
];
