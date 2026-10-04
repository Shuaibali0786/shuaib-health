import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DataUnavailable } from "@/components/ui/DataUnavailable";

describe("DataUnavailable", () => {
  it("shows the friendly message and a retry link to the current path", () => {
    render(<DataUnavailable />);
    expect(screen.getByText("This information is temporarily unavailable")).toBeInTheDocument();
    expect(screen.getByText("Please try again in a few minutes.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Try again" })).toHaveAttribute("href", "?");
  });

  it("accepts a custom title and retry href", () => {
    render(<DataUnavailable title="Doctors are unavailable" href="/doctors" />);
    expect(screen.getByText("Doctors are unavailable")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Try again" })).toHaveAttribute("href", "/doctors");
  });

  it("links to the phone when one is given", () => {
    render(<DataUnavailable phone={{ display: "+92 21 111", tel: "+9221111" }} />);
    expect(screen.getByRole("link", { name: "Call the clinic" })).toHaveAttribute("href", "tel:+9221111");
    expect(screen.queryByRole("link", { name: /contact/i })).not.toBeInTheDocument();
  });

  it("links to the contact page when there is no phone", () => {
    render(<DataUnavailable />);
    expect(screen.getByRole("link", { name: "Contact the clinic" })).toHaveAttribute("href", "/contact");
    expect(screen.queryByRole("link", { name: "Call the clinic" })).not.toBeInTheDocument();
  });

  it("uses no technical words", () => {
    const { container } = render(<DataUnavailable phone={{ display: "x", tel: "+1" }} />);
    expect(container.textContent ?? "").not.toMatch(/error|500|fetch|api/i);
  });
});
