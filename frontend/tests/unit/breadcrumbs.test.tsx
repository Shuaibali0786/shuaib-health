import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";

describe("Breadcrumbs", () => {
  it("is a labelled navigation landmark with an ordered list starting at Home", () => {
    render(<Breadcrumbs items={[{ label: "Doctors", href: "/doctors" }, { label: "Dr. Imran Qureshi" }]} />);
    const nav = screen.getByRole("navigation", { name: "Breadcrumb" });
    expect(nav.querySelector("ol")).not.toBeNull();
    const items = screen.getAllByRole("listitem").map((item) => item.textContent);
    expect(items).toEqual(["Home", "Doctors", "Dr. Imran Qureshi"]);
  });

  it("links every item except the last, which is the current page", () => {
    render(<Breadcrumbs items={[{ label: "Doctors", href: "/doctors" }, { label: "Dr. Imran Qureshi" }]} />);
    expect(screen.getByRole("link", { name: "Home" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: "Doctors" })).toHaveAttribute("href", "/doctors");
    expect(screen.queryByRole("link", { name: "Dr. Imran Qureshi" })).toBeNull();
    expect(screen.getByText("Dr. Imran Qureshi")).toHaveAttribute("aria-current", "page");
  });

  it("works for a single-level page", () => {
    render(<Breadcrumbs items={[{ label: "Contact" }]} />);
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(screen.getByText("Contact")).toHaveAttribute("aria-current", "page");
  });

  it("hides the separators from assistive technology", () => {
    const { container } = render(<Breadcrumbs items={[{ label: "Doctors" }]} />);
    for (const icon of container.querySelectorAll("svg")) expect(icon).toHaveAttribute("aria-hidden", "true");
  });
});
