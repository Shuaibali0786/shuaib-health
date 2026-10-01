import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Hero } from "@/components/home/Hero";
import { heroFacts, heroImage } from "@/data/homeContent";

const BANNED = /rating|review|testimonial|award|certified|accredited|patients served|years of experience|best |leading/i;

describe("Hero", () => {
  it("has one h1 and names the section after it", () => {
    const { container } = render(<Hero />);
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(container.querySelector("section")).toHaveAttribute("aria-labelledby", "hero-title");
  });

  it("offers Book Appointment and Find a Doctor", () => {
    render(<Hero />);
    expect(screen.getByRole("link", { name: "Book Appointment" })).toHaveAttribute("href", "/book-appointment");
    expect(screen.getByRole("link", { name: "Find a Doctor" })).toHaveAttribute("href", "/doctors");
  });

  it("shows exactly three fact cards with demo-true facts only", () => {
    render(<Hero />);
    const cards = within(screen.getByRole("list")).getAllByRole("listitem");
    expect(cards).toHaveLength(3);
    expect(cards.map((card) => card.textContent)).toEqual([
      "Open Mon–Sat, 9 AM – 9 PM PKT",
      "Lab reports online",
      "Home sample collection",
    ]);
    expect(heroFacts).toHaveLength(3);
  });

  it("uses no fabricated claims anywhere in the hero", () => {
    const { container } = render(<Hero />);
    expect(container.textContent).not.toMatch(BANNED);
  });

  it("shows the hero photo with alt text", () => {
    render(<Hero />);
    const photo = screen.getByRole("img", { name: heroImage.alt });
    expect(photo).toHaveAttribute("width", "1200");
    expect(photo).toHaveAttribute("height", "1500");
    expect(heroImage.src).toBe("/images/hero/hero-doctor.jpg");
    // It is the LCP image: loaded eagerly with a high fetch priority.
    expect(photo).toHaveAttribute("loading", "eager");
    expect(photo).toHaveAttribute("fetchpriority", "high");
  });
});
