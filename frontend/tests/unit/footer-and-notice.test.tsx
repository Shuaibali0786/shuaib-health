import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NoticeBar } from "@/components/layout/NoticeBar";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SkipLink } from "@/components/layout/SkipLink";
import { departments } from "../fixtures/catalog/departments";
import { siteConfig } from "../fixtures/catalog/siteConfig";
import { clinicState } from "./helpers/catalog-api-mock";

vi.mock("@/lib/api/cached", async () => (await import("./helpers/catalog-api-mock")).catalogApiMock);

beforeEach(() => {
  clinicState.mode = "ok";
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

describe("NoticeBar", () => {
  it("shows the exact demo notice", async () => {
    render(await NoticeBar());
    expect(screen.getByText("Portfolio demo — not a real clinic, not medical advice.")).toBeInTheDocument();
  });
});

describe("SkipLink", () => {
  it("points at the main content", () => {
    render(<SkipLink />);
    expect(screen.getByRole("link", { name: "Skip to main content" })).toHaveAttribute("href", "#main-content");
  });
});

describe("SiteFooter", () => {
  it("has the four columns: brand, quick links, departments, contact", async () => {
    const { container } = render(await SiteFooter());
    expect(screen.getByRole("link", { name: "Shuaib Health home" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Quick links" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Departments" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Contact" })).toBeInTheDocument();
    expect(container.querySelector("footer")).not.toBeNull();
  });

  it("lists all seven departments with links", async () => {
    render(await SiteFooter());
    const column = screen.getByRole("navigation", { name: "Departments" });
    const links = within(column).getAllByRole("link");
    expect(links).toHaveLength(7);
    expect(links.map((link) => link.textContent)).toEqual(departments.map((department) => department.name));
    expect(links[1]).toHaveAttribute("href", "/departments/cardiology");
  });

  it("labels the contact details as sample and shows hours in Karachi time", async () => {
    render(await SiteFooter());
    expect(screen.getByText("Sample details")).toBeInTheDocument();
    expect(screen.getByText("Mon–Sat, 9 AM – 9 PM PKT")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: siteConfig.generalPhone.display })).toHaveAttribute(
      "href",
      `tel:${siteConfig.generalPhone.tel}`,
    );
  });

  it("has Privacy and Terms links and repeats the demo notice", async () => {
    render(await SiteFooter());
    expect(screen.getByRole("link", { name: "Privacy" })).toHaveAttribute("href", "/privacy");
    expect(screen.getByRole("link", { name: "Terms" })).toHaveAttribute("href", "/terms");
    expect(screen.getByText("Portfolio demo — not a real clinic, not medical advice.")).toBeInTheDocument();
    expect(screen.getByText(/© 2026 Shuaib Health/)).toBeInTheDocument();
  });

  it("credits the author with a link to their GitHub profile", async () => {
    render(await SiteFooter());
    const credit = screen.getByRole("link", { name: "Designed & built by Shuaib Ali" });
    expect(credit).toHaveAttribute("href", "https://github.com/Shuaibali0786");
    expect(credit).toHaveAttribute("rel", expect.stringContaining("noopener"));
  });
});

describe("neutral identity (no clinic data from the API or the fallback)", () => {
  it("renders the footer with no tel: link and no crash, and keeps the constitution text", async () => {
    clinicState.mode = "down";
    const { container } = render(await SiteFooter());
    expect(container.querySelectorAll("a[href^='tel:']")).toHaveLength(0);
    expect(screen.getByRole("link", { name: "Clinic home" })).toBeInTheDocument();
    expect(screen.getByText("Portfolio demo — not a real clinic, not medical advice.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Designed & built by Shuaib Ali" })).toBeInTheDocument();
  });

  it("renders the notice bar", async () => {
    clinicState.mode = "down";
    render(await NoticeBar());
    expect(screen.getByText("Portfolio demo — not a real clinic, not medical advice.")).toBeInTheDocument();
  });
});
