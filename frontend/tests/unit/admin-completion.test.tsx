// Feature 008: quick date ranges, the roles table and the print button.
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { QuickRangeChips } from "@/admin/bookings/FilterBar";
import { PrintButton } from "@/admin/bookings/PrintButton";
import { activeRange, addDays, quickRanges } from "@/admin/lib/quickRanges";
import { NAV_ITEMS } from "@/admin/shell/nav";
import { PermissionsCard } from "@/admin/staff/PermissionsCard";
import { CAPABILITIES } from "@/admin/staff/permissions";

describe("addDays", () => {
  it("crosses month, year and leap-day boundaries", () => {
    expect(addDays("2026-11-30", 1)).toBe("2026-12-01");
    expect(addDays("2026-12-29", 6)).toBe("2027-01-04");
    expect(addDays("2027-01-03", -6)).toBe("2026-12-28");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDays("2027-02-28", 1)).toBe("2027-03-01");
  });
  it("refuses a malformed date", () => {
    expect(() => addDays("7/11/2026", 1)).toThrow(RangeError);
  });
});

describe("quickRanges and activeRange", () => {
  const today = "2026-11-07";
  it("builds the four ranges from the clinic's today", () => {
    expect(quickRanges(today)).toEqual([
      { id: "today", label: "Today", from: "2026-11-07", to: "2026-11-07" },
      { id: "tomorrow", label: "Tomorrow", from: "2026-11-08", to: "2026-11-08" },
      { id: "next7", label: "Next 7 days", from: "2026-11-07", to: "2026-11-13" },
      { id: "last7", label: "Last 7 days", from: "2026-11-01", to: "2026-11-07" },
    ]);
  });
  it("matches only an exact range; no dates means today", () => {
    expect(activeRange({ from: null, to: null }, today)).toBe("today");
    expect(activeRange({ from: "2026-11-08", to: null }, today)).toBe("tomorrow");
    expect(activeRange({ from: "2026-11-01", to: "2026-11-07" }, today)).toBe("last7");
    expect(activeRange({ from: "2026-11-02", to: "2026-11-07" }, today)).toBeNull();
  });
});

describe("QuickRangeChips", () => {
  it("sets the range, resets the page and shows the pressed chip", async () => {
    const onChange = vi.fn();
    render(<QuickRangeChips filters={{ from: null, to: null }} today="2026-11-07" onChange={onChange} />);
    const group = screen.getByRole("group", { name: "Date range" });
    expect(within(group).getByRole("button", { name: "Today" })).toHaveAttribute("aria-pressed", "true");
    expect(within(group).getByRole("button", { name: "Tomorrow" })).toHaveAttribute("aria-pressed", "false");
    await userEvent.click(within(group).getByRole("button", { name: "Next 7 days" }));
    expect(onChange).toHaveBeenCalledWith({ from: "2026-11-07", to: "2026-11-13", page: 1 });
  });
});

describe("Roles and permissions", () => {
  it("admin-only capabilities are exactly the admin-only screens", () => {
    const adminOnlyNav = NAV_ITEMS.filter((item) => item.adminOnly).map((item) => item.href).sort();
    const adminOnlyCaps = CAPABILITIES.filter((c) => !c.roles.includes("receptionist") && c.navHref).map((c) => c.navHref).sort();
    expect(adminOnlyCaps).toEqual(adminOnlyNav);
    for (const item of NAV_ITEMS.filter((i) => !i.adminOnly)) {
      const cap = CAPABILITIES.find((c) => c.navHref === item.href);
      expect(cap?.roles).toContain("receptionist");
    }
  });
  it("renders a captioned table with spoken allowed / not allowed", () => {
    render(<PermissionsCard />);
    const table = screen.getByRole("table", { name: "What each role can do" });
    const row = within(table).getByRole("row", { name: /audit/ });
    expect(within(row).getByText("Allowed for Admin")).toBeInTheDocument();
    expect(within(row).getByText("Not allowed for Receptionist")).toBeInTheDocument();
  });
});

describe("PrintButton", () => {
  it("opens the browser print dialog once", async () => {
    const print = vi.spyOn(window, "print").mockImplementation(() => {});
    render(<PrintButton />);
    await userEvent.click(screen.getByRole("button", { name: "Print list" }));
    expect(print).toHaveBeenCalledTimes(1);
    print.mockRestore();
  });
});
