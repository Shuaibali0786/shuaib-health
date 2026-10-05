import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { FaqGroupSection } from "@/components/faq/FaqGroup";
import { faqGroups } from "@/data/faq";
import { BANNED_CLAIMS, BRAND_WORDS, stringValues } from "./helpers/forbidden";

const group = faqGroups[3]!;

describe("FaqGroupSection", () => {
  it("is a labelled section with the slug as its anchor id and an h2 title", () => {
    const { container } = render(<FaqGroupSection group={group} />);
    const section = container.querySelector("section")!;
    expect(section).toHaveAttribute("id", "home-sample-collection");
    expect(screen.getByRole("heading", { level: 2, name: "Home sample collection" })).toBeInTheDocument();
    expect(section).toHaveAccessibleName("Home sample collection");
  });

  it("renders one closed <details> per question, with the answer inside", () => {
    const { container } = render(<FaqGroupSection group={group} />);
    const items = container.querySelectorAll("details");
    expect(items).toHaveLength(group.items.length);
    for (const [index, item] of group.items.entries()) {
      expect(items[index]).not.toHaveAttribute("open");
      expect(within(items[index] as HTMLElement).getByText(item.question)).toBeInTheDocument();
      expect(within(items[index] as HTMLElement).getByText(item.answer)).toBeInTheDocument();
    }
  });

  it("opens and closes an item when its summary is activated", async () => {
    const { container } = render(<FaqGroupSection group={group} />);
    const first = container.querySelector("details")!;
    const summary = first.querySelector("summary") as HTMLElement;
    await userEvent.click(summary);
    expect(first).toHaveAttribute("open");
    await userEvent.click(summary);
    expect(first).not.toHaveAttribute("open");
  });

  it("makes the summary focusable by keyboard (Enter and Space toggling is native and is checked in Playwright)", async () => {
    const { container } = render(<FaqGroupSection group={group} />);
    const summary = container.querySelector("summary") as HTMLElement;
    await userEvent.tab();
    expect(summary).toHaveFocus();
  });

  it("only rotates the chevron when motion is allowed", () => {
    const { container } = render(<FaqGroupSection group={group} />);
    const chevron = container.querySelector("summary svg")!;
    expect(chevron.getAttribute("class")).toContain("motion-safe:transition-transform");
    expect(chevron).toHaveAttribute("aria-hidden", "true");
  });
});

describe("FAQ data", () => {
  it("has the five groups in order with the anchors the site links to", () => {
    expect(faqGroups.map((entry) => [entry.slug, entry.title])).toEqual([
      ["appointments", "Appointments"],
      ["lab-tests-reports", "Lab tests & reports"],
      ["payments", "Payments"],
      ["home-sample-collection", "Home sample collection"],
      ["privacy", "Privacy"],
    ]);
  });

  it("has at least three questions per group, about twenty in all, with unique ids", () => {
    for (const entry of faqGroups) expect(entry.items.length, entry.slug).toBeGreaterThanOrEqual(3);
    const items = faqGroups.flatMap((entry) => entry.items);
    expect(items.length).toBeGreaterThanOrEqual(18);
    expect(new Set([...faqGroups.map((entry) => entry.id), ...items.map((item) => item.id)]).size).toBe(faqGroups.length + items.length);
    for (const item of items) {
      expect(item.question.trim().endsWith("?")).toBe(true);
      expect(item.answer.trim().length).toBeGreaterThan(20);
    }
  });

  it("never claims a live service and contains no claim words or brand names", () => {
    const text = stringValues(faqGroups);
    expect(text.filter((value) => BANNED_CLAIMS.test(value) || BRAND_WORDS.test(value))).toEqual([]);
    expect(faqGroups[0]!.items[0]!.answer).toMatch(/try online booking with the sample doctors/i);
    expect(faqGroups[2]!.items[1]!.answer).toMatch(/not available/i);
    expect(faqGroups[1]!.items[3]!.answer).toMatch(/planned/i);
  });
});
