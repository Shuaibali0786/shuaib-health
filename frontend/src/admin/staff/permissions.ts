import type { Role } from "@/admin/lib/schemas";

/**
 * What each staff role may do, in words, for the "What each role can do" table (Feature 008, US2).
 * This explains the rules; the server's policy table (`backend/app/auth/policies.py`) enforces them.
 * `navHref` ties a capability to its screen so a unit test can prove the table and the navigation agree.
 */
export type Capability = { id: string; label: string; roles: readonly Role[]; navHref?: string };

export const ROLES: readonly { role: Role; label: string }[] = [
  { role: "admin", label: "Admin" },
  { role: "receptionist", label: "Receptionist" },
];

export const CAPABILITIES: readonly Capability[] = [
  { id: "overview", label: "See today's overview and agenda", roles: ["admin", "receptionist"], navHref: "/admin" },
  { id: "bookings", label: "Search and filter bookings", roles: ["admin", "receptionist"], navHref: "/admin/bookings" },
  { id: "status", label: "Mark arrived, completed, no-show or cancelled", roles: ["admin", "receptionist"] },
  { id: "phone", label: "Reveal a patient's phone (logged)", roles: ["admin", "receptionist"] },
  { id: "doctors", label: "See doctors today", roles: ["admin", "receptionist"], navHref: "/admin/doctors" },
  { id: "insights", label: "See insights and charts", roles: ["admin", "receptionist"], navHref: "/admin/insights" },
  { id: "activity", label: "Read the activity (audit) log", roles: ["admin"], navHref: "/admin/activity" },
  { id: "staff", label: "Add staff, change roles, reset passwords", roles: ["admin"], navHref: "/admin/staff" },
];
