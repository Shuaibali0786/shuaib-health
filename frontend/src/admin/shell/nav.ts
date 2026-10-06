import { BarChart3, CalendarCheck, LayoutDashboard, ScrollText, Stethoscope, Users, type LucideIcon } from "lucide-react";

import type { Viewer } from "@/admin/lib/schemas";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Shown only to admins (and to the demo viewer, whose data is synthetic). */
  adminOnly?: boolean;
};

export const NAV_ITEMS: readonly NavItem[] = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/bookings", label: "Bookings", icon: CalendarCheck },
  { href: "/admin/doctors", label: "Doctors", icon: Stethoscope },
  { href: "/admin/insights", label: "Insights", icon: BarChart3 },
  { href: "/admin/activity", label: "Activity", icon: ScrollText, adminOnly: true },
  { href: "/admin/staff", label: "Staff", icon: Users, adminOnly: true },
];

/** The items a viewer may see. The server enforces the same rule; hiding a link is only a courtesy. */
export function visibleNavItems(viewer: Pick<Viewer, "kind" | "role">): NavItem[] {
  const seesAdminScreens = viewer.kind === "demo" || viewer.role === "admin";
  return NAV_ITEMS.filter((item) => !item.adminOnly || seesAdminScreens);
}

/** Overview matches only itself; every other item also matches its sub-pages. */
export function isActive(href: string, pathname: string): boolean {
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function roleLabel(viewer: Pick<Viewer, "kind" | "role">): string {
  if (viewer.kind === "demo") return "Read-only · Admin view";
  return viewer.role === "admin" ? "Admin" : "Receptionist";
}

/** Up to two capital letters from the clinic name for the round monogram: "Shuaib Health" -> "SH". */
export function monogram(clinicName: string): string {
  return clinicName
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => [...word][0] ?? "")
    .join("")
    .toUpperCase();
}

export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const letters = words.length > 1 ? [words[0], words[words.length - 1]] : [words[0]];
  return letters.map((word) => (word ? [...word][0] : "")).join("").toUpperCase();
}
