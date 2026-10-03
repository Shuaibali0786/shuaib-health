import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ComingSoon } from "@/components/coming-soon/ComingSoon";

describe("ComingSoon", () => {
  it("shows the Coming soon heading, the page title and a way back Home", () => {
    render(<ComingSoon title="Lab Tests" />);
    expect(screen.getByRole("heading", { level: 1, name: "Coming soon" })).toBeInTheDocument();
    expect(screen.getByText("Lab Tests")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to Home" })).toHaveAttribute("href", "/");
  });

  it("says the page is not built in the demo yet", () => {
    render(<ComingSoon title="Doctors" />);
    expect(screen.getByText(/not built in the demo yet/i)).toBeInTheDocument();
  });

  it("works for any title, such as a doctor's name", () => {
    render(<ComingSoon title="Dr. Imran Qureshi" />);
    expect(screen.getByText("Dr. Imran Qureshi")).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  });
});

describe("ComingSoon as the booking holding page", () => {
  it("accepts a custom heading, message and a second link", () => {
    render(
      <ComingSoon
        title="Book appointment"
        heading="Booking coming soon"
        message="Online booking is not available in this demo yet."
        secondary={{ label: "Find a doctor", href: "/doctors" }}
      />,
    );
    expect(screen.getByRole("heading", { level: 1, name: "Booking coming soon" })).toBeInTheDocument();
    expect(screen.getByText("Online booking is not available in this demo yet.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Find a doctor" })).toHaveAttribute("href", "/doctors");
    expect(screen.getByRole("link", { name: "Back to Home" })).toHaveAttribute("href", "/");
  });
});
