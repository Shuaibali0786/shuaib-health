import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ConfirmDialog, confirmTitle, type ChangeRequest } from "@/admin/bookings/ConfirmDialog";
import { StatusActions, quickAction } from "@/admin/bookings/StatusActions";
import { bookingMessage, latestFrom } from "@/admin/bookings/copy";
import { AdminApiError } from "@/admin/lib/client";
import type { BookingSummary } from "@/admin/lib/schemas";
import { allowedNext, timeHint } from "@/admin/lib/statusRules";

const booking: BookingSummary = {
  reference: "RAYESHA001",
  startsAt: "2026-10-05T06:40:00Z",
  endsAt: "2026-10-05T07:00:00Z",
  localDate: "2026-10-05",
  localTime: "11:40",
  status: "confirmed",
  version: 1,
  patientNameMasked: "Ayesha K.",
  phoneMasked: "0300****567",
  doctor: { id: "3f2b8c1e-5a47-4c0b-9d11-0a1b2c3d4e5f", name: "Dr. Ayesha Rahman", departmentName: "Gynecology" },
  allowedNext: ["arrived", "cancelled"],
};

describe("StatusActions", () => {
  it("shows only the changes the server allows, and nothing else", () => {
    render(<StatusActions allowedNext={["arrived", "cancelled"]} onChoose={vi.fn()} />);
    expect(screen.getAllByRole("button").map((b) => b.textContent)).toEqual(["Mark arrived", "Cancel booking"]);
    expect(screen.queryByRole("button", { name: "Mark completed" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Mark no-show" })).toBeNull();
  });

  it("shows no buttons for a final status", () => {
    render(<StatusActions allowedNext={[]} onChoose={vi.fn()} />);
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });

  it("reports the choice", async () => {
    const onChoose = vi.fn();
    render(<StatusActions allowedNext={["completed", "no_show"]} onChoose={onChoose} />);
    await userEvent.click(screen.getByRole("button", { name: "Mark no-show" }));
    expect(onChoose).toHaveBeenCalledWith("no_show");
  });

  it("offers one quick action: Arrived for a confirmed booking, Complete for an arrived one", () => {
    expect(quickAction(["arrived", "cancelled"])).toEqual({ to: "arrived", label: "Arrived" });
    expect(quickAction(["completed", "no_show"])).toEqual({ to: "completed", label: "Complete" });
    expect(quickAction(["cancelled"])).toBeNull();
    expect(quickAction([])).toBeNull();
  });
});

describe("ConfirmDialog", () => {
  const request: ChangeRequest = { booking, to: "arrived" };

  it("asks with the patient and the time, and the safe choice has the focus", () => {
    render(<ConfirmDialog request={request} busy={false} onConfirm={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByRole("alertdialog", { name: "Mark Ayesha K. as arrived for 11:40?" })).toBeTruthy();
    expect(screen.getByText(/You can undo this for 10 seconds/)).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Not now" }));
  });

  it("changes nothing until the person confirms", async () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(<ConfirmDialog request={request} busy={false} onConfirm={onConfirm} onCancel={onCancel} />);
    await userEvent.click(screen.getByRole("button", { name: "Not now" }));
    expect(onConfirm).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Mark arrived" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("words each change plainly", () => {
    expect(confirmTitle({ booking, to: "completed" })).toBe("Mark Ayesha K. as completed?");
    expect(confirmTitle({ booking, to: "no_show" })).toBe("Mark Ayesha K. as a no-show?");
    expect(confirmTitle({ booking, to: "cancelled" })).toBe("Cancel the booking for Ayesha K. at 11:40?");
  });
});

describe("a booking changed by someone else (409)", () => {
  it("says so calmly and carries the booking as it is now", () => {
    const latest = { ...booking, status: "arrived", patientName: "Ayesha Khan", feePkr: 3500, bookedAt: "2026-10-02T07:22:00Z", history: [], allowedNext: ["completed"] };
    const error = new AdminApiError(409, "booking_changed", null, { error: { code: "booking_changed", message: "m", requestId: "r" }, latest });
    expect(bookingMessage(error)).toContain("This booking was changed by someone else");
    expect(latestFrom(error)?.status).toBe("arrived");
  });

  it("never shows a status code or a stack for any other failure", () => {
    expect(bookingMessage(new Error("boom"))).toBe("Something went wrong. Please try again.");
    expect(bookingMessage(new AdminApiError(0, "network"))).toMatch(/could not reach/);
  });
});

describe("the demo's copy of the rules", () => {
  const start = Date.parse("2026-10-05T06:40:00Z");
  it("matches the lifecycle around the start time", () => {
    expect(allowedNext("confirmed", start, start - 3 * 3600_000)).toEqual(["cancelled"]);
    expect(allowedNext("confirmed", start, start - 3600_000)).toEqual(["arrived", "cancelled"]);
    expect(allowedNext("confirmed", start, start + 60_000)).toEqual(["arrived", "no_show"]);
    expect(allowedNext("arrived", start, start + 60_000)).toEqual(["completed", "no_show"]);
    expect(allowedNext("completed", start, start)).toEqual([]);
  });

  it("explains when Arrived and No-show open", () => {
    const at = (ms: number) => new Date(ms).toISOString().slice(11, 16);
    expect(timeHint("confirmed", start, start - 3 * 3600_000, at)).toBe("Arrived can be marked from 04:40. No-show becomes available at 06:40.");
    expect(timeHint("confirmed", start, start - 600_000, at)).toBe("No-show becomes available at 06:40.");
    expect(timeHint("arrived", start, start, at)).toBeNull();
  });
});
