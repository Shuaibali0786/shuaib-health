import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { WhyChooseUs } from "@/components/home/WhyChooseUs";
import { clinicImage, whyPoints } from "@/data/homeContent";

vi.mock("@/lib/api/cached", async () => (await import("./helpers/catalog-api-mock")).catalogApiMock);

// EmergencyCard is an async server component, which jsdom cannot render inside another
// component. It has its own test in home-sections.test.tsx; here it is replaced by a stub.
vi.mock("@/components/home/EmergencyCard", () => ({
  EmergencyCard: () => (
    <aside aria-labelledby="emergency-title">
      <h3 id="emergency-title">In an emergency</h3>
    </aside>
  ),
}));

describe("WhyChooseUs", () => {
  it("shows a section heading, four or five plain points and the clinic photo", async () => {
    render(await WhyChooseUs());
    expect(screen.getByRole("heading", { level: 2, name: "Why choose Shuaib Health" })).toBeInTheDocument();
    for (const point of whyPoints) {
      expect(screen.getByRole("heading", { level: 3, name: point.title })).toBeInTheDocument();
      expect(screen.getByText(point.text)).toBeInTheDocument();
    }
    expect(whyPoints.length).toBeGreaterThanOrEqual(4);
    expect(whyPoints.length).toBeLessThanOrEqual(5);
    expect(screen.getByRole("img", { name: clinicImage.alt })).toBeInTheDocument();
  });

  it("places the emergency card in the section", async () => {
    render(await WhyChooseUs());
    expect(screen.getByRole("complementary", { name: "In an emergency" })).toBeInTheDocument();
  });

  it("makes no superlative, comparative or numeric claims", async () => {
    const { container } = render(await WhyChooseUs());
    expect(container.textContent).not.toMatch(/\b(best|leading|number one|#1|top-rated|award|certified|accredited)\b/i);
    expect(container.textContent).not.toMatch(/\d/);
  });
});
