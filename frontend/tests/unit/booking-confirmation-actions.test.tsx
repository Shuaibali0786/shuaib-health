import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ConfirmationActions } from "@/components/booking/ConfirmationActions";
import type { AppointmentView } from "@/lib/booking/schemas";

const view: AppointmentView = {
  reference: "ABCDE-FGHJK",
  status: "confirmed",
  doctor: { slug: "dr-imran-qureshi", fullName: "Dr. Imran Qureshi", specialty: "Cardiology" },
  department: { slug: "cardiology", name: "Cardiology" },
  startsAt: "2026-10-06T09:00:00Z",
  endsAt: "2026-10-06T09:15:00Z",
  localDate: "2026-10-06",
  localTime: "14:00",
  timeZone: "Asia/Karachi",
  feePkr: 2500,
  patientNameMasked: "A**** K****",
  mobileMasked: "0300****567",
  bookedAt: "2026-10-04T09:05:00Z",
  isSample: true,
};
const clinic = { name: "Shuaib Health", address: ["12 Example Road"], phoneDisplay: "+92 21 111 000 111", phoneTel: "+9221111000111" };

function setCoarsePointer(coarse: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({ matches: coarse && query.includes("coarse"), media: query })) as never;
}

const originalCanShare = Object.getOwnPropertyDescriptor(navigator, "canShare");
const originalShare = Object.getOwnPropertyDescriptor(navigator, "share");
function setShare(canShare: ((data: ShareData) => boolean) | undefined, share?: (data: ShareData) => Promise<void>) {
  Object.defineProperty(navigator, "canShare", { value: canShare, configurable: true });
  Object.defineProperty(navigator, "share", { value: share, configurable: true });
}

let clicked: { download: string; href: string }[];

beforeEach(() => {
  clicked = [];
  URL.createObjectURL = vi.fn(() => "blob:slip");
  URL.revokeObjectURL = vi.fn();
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
    clicked.push({ download: this.download, href: this.href });
  });
  setCoarsePointer(false);
  setShare(undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
  if (originalCanShare) Object.defineProperty(navigator, "canShare", originalCanShare);
  else Reflect.deleteProperty(navigator, "canShare");
  if (originalShare) Object.defineProperty(navigator, "share", originalShare);
  else Reflect.deleteProperty(navigator, "share");
});

describe("confirmation actions", () => {
  it("offers the download first and the four other actions", () => {
    render(<ConfirmationActions view={view} clinic={clinic} />);
    const download = screen.getByRole("button", { name: "Download your slip" });
    expect(download).toBeVisible();
    expect(download.className).toContain("min-h-14"); // 56 px, above the 48 px minimum
    expect(screen.getByRole("button", { name: "Print" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Add to calendar" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Book another appointment" })).toHaveAttribute("href", "/book-appointment");
    const whatsapp = screen.getByRole("link", { name: "Share on WhatsApp" });
    const text = decodeURIComponent(whatsapp.getAttribute("href")!.split("?text=")[1]!);
    expect(text).toContain("ABCDE-FGHJK");
    expect(text).toContain("+92 21 111 000 111");
    expect(text).not.toContain("****");
  });

  it("downloads the PDF on a desktop even when file sharing exists", async () => {
    setShare(() => true, vi.fn());
    render(<ConfirmationActions view={view} clinic={clinic} />);
    await userEvent.click(screen.getByRole("button", { name: "Download your slip" }));
    await waitFor(() => expect(clicked).toEqual([{ download: "appointment-slip-ABCDE-FGHJK.pdf", href: "blob:slip" }]));
    expect(screen.getByRole("status")).toHaveTextContent("Your slip was downloaded");
  });

  it("shares the PDF as a file on a phone that supports it", async () => {
    setCoarsePointer(true);
    const share = vi.fn().mockResolvedValue(undefined);
    setShare(() => true, share);
    render(<ConfirmationActions view={view} clinic={clinic} />);
    await userEvent.click(screen.getByRole("button", { name: "Download your slip" }));
    await waitFor(() => expect(share).toHaveBeenCalledTimes(1));
    const [data] = share.mock.calls[0] as [ShareData];
    expect(data.files).toHaveLength(1);
    expect(data.files?.[0]?.name).toBe("appointment-slip-ABCDE-FGHJK.pdf");
    expect(data.files?.[0]?.type).toBe("application/pdf");
    expect(clicked).toEqual([]);
  });

  it("downloads on a phone that cannot share files", async () => {
    setCoarsePointer(true);
    setShare(() => false, vi.fn());
    render(<ConfirmationActions view={view} clinic={clinic} />);
    await userEvent.click(screen.getByRole("button", { name: "Download your slip" }));
    await waitFor(() => expect(clicked).toHaveLength(1));
  });

  it("falls back to a download when sharing fails, and stays quiet when the visitor cancels", async () => {
    setCoarsePointer(true);
    const share = vi.fn().mockRejectedValueOnce(new DOMException("denied", "NotAllowedError")).mockRejectedValueOnce(new DOMException("cancelled", "AbortError"));
    setShare(() => true, share);
    render(<ConfirmationActions view={view} clinic={clinic} />);
    await userEvent.click(screen.getByRole("button", { name: "Download your slip" }));
    await waitFor(() => expect(clicked).toHaveLength(1));
    await userEvent.click(screen.getByRole("button", { name: "Download your slip" }));
    await waitFor(() => expect(share).toHaveBeenCalledTimes(2));
    expect(clicked).toHaveLength(1);
  });

  it("saves a calendar file", async () => {
    render(<ConfirmationActions view={view} clinic={clinic} />);
    await userEvent.click(screen.getByRole("button", { name: "Add to calendar" }));
    expect(clicked).toEqual([{ download: "appointment-ABCDE-FGHJK.ics", href: "blob:slip" }]);
  });

  it("prints", async () => {
    const print = vi.spyOn(window, "print").mockImplementation(() => undefined);
    render(<ConfirmationActions view={view} clinic={clinic} />);
    await userEvent.click(screen.getByRole("button", { name: "Print" }));
    expect(print).toHaveBeenCalledTimes(1);
  });
});
