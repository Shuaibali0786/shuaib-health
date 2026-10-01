import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MobileMenu } from "@/components/layout/MobileMenu";
import { NavLinks } from "@/components/layout/NavLinks";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { primaryNav } from "@/data/navigation";
import { siteConfig } from "@/data/siteConfig";
import { isActivePath } from "@/lib/routes";

const router = vi.hoisted(() => ({ pathname: "/" }));
vi.mock("next/navigation", () => ({ usePathname: () => router.pathname }));

beforeEach(() => {
  router.pathname = "/";
});

describe("isActivePath", () => {
  it("matches Home only on /", () => {
    expect(isActivePath("/", "/")).toBe(true);
    expect(isActivePath("/doctors", "/")).toBe(false);
  });

  it("matches a section and its sub-paths, but not look-alikes", () => {
    expect(isActivePath("/doctors", "/doctors")).toBe(true);
    expect(isActivePath("/doctors/dr-imran-qureshi", "/doctors")).toBe(true);
    expect(isActivePath("/doctors-and-more", "/doctors")).toBe(false);
  });
});

describe("NavLinks", () => {
  it("lists the eight links in the required order", () => {
    render(<NavLinks items={primaryNav} layout="inline" />);
    const labels = screen.getAllByRole("link").map((link) => link.textContent);
    expect(labels).toEqual([
      "Home",
      "About",
      "Doctors",
      "Departments",
      "Lab Tests",
      "Health Packages",
      "Health Tips",
      "Contact",
    ]);
  });

  it.each([
    ["/", "Home"],
    ["/doctors", "Doctors"],
    ["/doctors/dr-imran-qureshi", "Doctors"],
    ["/health-tips/staying-hydrated", "Health Tips"],
  ])("marks exactly one link as the current page on %s", (pathname, expected) => {
    router.pathname = pathname;
    render(<NavLinks items={primaryNav} layout="inline" />);
    const current = screen.getAllByRole("link").filter((link) => link.getAttribute("aria-current") === "page");
    expect(current.map((link) => link.textContent)).toEqual([expected]);
  });

  it("marks no link as current on a path outside the navigation", () => {
    router.pathname = "/privacy";
    render(<NavLinks items={primaryNav} layout="stacked" />);
    expect(screen.getAllByRole("link").some((link) => link.hasAttribute("aria-current"))).toBe(false);
  });
});

describe("MobileMenu", () => {
  const renderMenu = () => render(<MobileMenu items={primaryNav} emergencyPhone={siteConfig.emergencyPhone} />);
  const menuButton = () => screen.getByRole("button", { name: /menu/i });

  it("starts closed with the right accessibility state", () => {
    renderMenu();
    expect(menuButton()).toHaveAccessibleName("Open menu");
    expect(menuButton()).toHaveAttribute("aria-expanded", "false");
    expect(menuButton()).toHaveAttribute("aria-controls", "mobile-menu");
    expect(document.getElementById("mobile-menu")).toHaveAttribute("hidden");
  });

  it("opens on click and shows the links, emergency phone and Book Appointment", async () => {
    const user = userEvent.setup();
    renderMenu();
    await user.click(menuButton());

    expect(menuButton()).toHaveAccessibleName("Close menu");
    expect(menuButton()).toHaveAttribute("aria-expanded", "true");
    const panel = document.getElementById("mobile-menu") as HTMLElement;
    expect(panel).not.toHaveAttribute("hidden");
    expect(within(panel).getAllByRole("link").length).toBe(primaryNav.length + 2);
    expect(within(panel).getByRole("link", { name: /\+92 21 0000 0000/ })).toHaveAttribute(
      "href",
      `tel:${siteConfig.emergencyPhone.tel}`,
    );
    expect(within(panel).getByRole("link", { name: "Book Appointment" })).toHaveAttribute("href", "/book-appointment");
  });

  it("closes on Escape and returns focus to the menu button", async () => {
    const user = userEvent.setup();
    renderMenu();
    await user.click(menuButton());
    await user.keyboard("{Escape}");

    expect(menuButton()).toHaveAttribute("aria-expanded", "false");
    expect(menuButton()).toHaveFocus();
  });

  it("closes when the visitor taps outside it", async () => {
    const user = userEvent.setup();
    render(
      <div>
        <p>Outside</p>
        <MobileMenu items={primaryNav} emergencyPhone={siteConfig.emergencyPhone} />
      </div>,
    );
    await user.click(menuButton());
    await user.click(screen.getByText("Outside"));

    expect(menuButton()).toHaveAttribute("aria-expanded", "false");
  });

  it("closes after navigation to another page", async () => {
    const user = userEvent.setup();
    const { rerender } = renderMenu();
    await user.click(menuButton());
    expect(menuButton()).toHaveAttribute("aria-expanded", "true");

    router.pathname = "/doctors";
    rerender(<MobileMenu items={primaryNav} emergencyPhone={siteConfig.emergencyPhone} />);
    expect(menuButton()).toHaveAttribute("aria-expanded", "false");
  });
});

describe("SiteHeader", () => {
  it("shows the logo link, primary navigation, emergency phone and Book Appointment", async () => {
    render(await SiteHeader());

    expect(screen.getByRole("link", { name: "Shuaib Health home" })).toHaveAttribute("href", "/");
    const primary = screen.getByRole("navigation", { name: "Primary", hidden: true });
    expect(within(primary).getAllByRole("link", { hidden: true })).toHaveLength(8);

    const phoneLinks = screen
      .getAllByRole("link", { hidden: true })
      .filter((link) => link.getAttribute("href") === `tel:${siteConfig.emergencyPhone.tel}`);
    expect(phoneLinks.length).toBeGreaterThanOrEqual(2);
    expect(screen.getByRole("link", { name: "Call emergency phone (sample number)" })).toBeInTheDocument();
    expect(screen.getAllByText("Emergency (sample)").length).toBeGreaterThanOrEqual(1);

    const book = screen
      .getAllByRole("link", { hidden: true })
      .filter((link) => link.getAttribute("href") === "/book-appointment");
    expect(book.length).toBeGreaterThanOrEqual(1);
    expect(book[0]).toHaveAccessibleName("Book Appointment");
  });

  it("is sticky", async () => {
    const { container } = render(await SiteHeader());
    expect(container.querySelector("header")).toHaveClass("sticky", "top-0");
  });

  it("wraps instead of overflowing when text is enlarged or spaced out (WCAG 1.4.12)", async () => {
    const { container } = render(await SiteHeader());
    const row = container.querySelector("header > div");
    expect(row).toHaveClass("flex-wrap", "min-h-16");
    expect(row).not.toHaveClass("h-16");
  });
});
