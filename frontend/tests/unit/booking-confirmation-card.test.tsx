import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ConfirmationCard } from "@/components/booking/ConfirmationCard";
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
const site = {
  name: "Shuaib Health",
  address: ["12 Example Road", "Karachi"],
  generalPhone: { display: "+92 21 111 000 111", tel: "+9221111000111" },
  emergencyPhone: { display: "1122", tel: "1122" },
};

describe("confirmation card", () => {
  it("shows the doctor's fee by default, and for a lab test booked by voice the TEST and its price instead", () => {
    const { unmount } = render(<ConfirmationCard view={view} site={site} />);
    expect(screen.getByRole("article")).toHaveTextContent("PKR 2,500 (sample)");
    unmount();
    render(<ConfirmationCard view={view} site={site} labTest={{ name: "Complete Blood Count (CBC)", pricePkr: 800 }} />);
    const card = screen.getByRole("article");
    expect(card).toHaveTextContent("Complete Blood Count (CBC)");
    expect(card).toHaveTextContent("PKR 800 (sample)");
    expect(card).not.toHaveTextContent("PKR 2,500");
  });

  it("shows the date with year, the 12-hour time in Pakistan time and the arrive-by time", () => {
    render(<ConfirmationCard view={view} site={site} />);
    const card = screen.getByRole("article");
    expect(card).toHaveTextContent("Tue 6 Oct 2026");
    expect(card).toHaveTextContent("2:00 PM (Pakistan time)");
    expect(card).toHaveTextContent("Please arrive by 1:45 PM");
  });

  it("has the double-ring CONFIRMED stamp: name on top, DEMO below, booked day and month in the middle", () => {
    render(<ConfirmationCard view={view} site={site} />);
    const seal = screen.getByTestId("confirmed-seal");
    expect(seal).toHaveTextContent("CONFIRMED");
    expect(seal).toHaveTextContent("BOOKED 04 OCT");
    expect(seal).toHaveTextContent("SHUAIB HEALTH");
    expect(seal).toHaveTextContent("• DEMO •");
    expect(seal).toHaveAccessibleName("Confirmed, booked 04 Oct, demo booking");
    expect(seal.querySelectorAll("circle")).toHaveLength(2);
  });

  it("has a QR code for the reference labelled Show at reception", () => {
    render(<ConfirmationCard view={view} site={site} />);
    expect(screen.getByRole("img", { name: "QR code for booking reference ABCDE-FGHJK" })).toBeInTheDocument();
    expect(screen.getByText("Show at reception")).toBeInTheDocument();
  });

  it("has the Before you come box with the emergency number from the settings", () => {
    render(<ConfirmationCard view={view} site={site} />);
    const box = screen.getByRole("heading", { name: "Before you come" }).closest("section")!;
    expect(box).toHaveTextContent("Arrive 15 minutes early.");
    expect(box).toHaveTextContent("Bring your CNIC and any previous reports.");
    expect(within(box).getByRole("link", { name: "1122" })).toHaveAttribute("href", "tel:1122");
  });

  it("leaves the emergency line out when no number is set", () => {
    render(<ConfirmationCard view={view} site={{ ...site, emergencyPhone: { display: "", tel: "" } }} />);
    expect(screen.getByRole("article")).not.toHaveTextContent("Emergency?");
  });

  it("ends with the booking time and the demo notice, and keeps the patient masked", () => {
    render(<ConfirmationCard view={view} site={site} />);
    const card = screen.getByRole("article");
    expect(card).toHaveTextContent("Booked on 4 Oct 2026, 2:05 PM Pakistan time");
    expect(card).toHaveTextContent("Demo booking, no one will contact you");
    expect(card).toHaveTextContent("A**** K****");
    expect(card).toHaveTextContent("0300****567");
  });
});
