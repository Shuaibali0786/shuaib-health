import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TipCard } from "@/components/home/TipCard";
import { ArticleBody } from "@/components/tips/ArticleBody";
import { MedicalNote } from "@/components/tips/MedicalNote";
import { TipBrowser, TipBrowserFallback } from "@/components/tips/TipBrowser";
import { healthTips } from "@/data/healthTips";

let search = "";
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(search),
}));

const categories = [...new Set(healthTips.map((tip) => tip.category))];
const cards = () => screen.queryAllByRole("article");

beforeEach(() => {
  search = "";
  window.history.replaceState(null, "", "/health-tips");
});

describe("TipCard", () => {
  it("shows the reading time only when asked, so Home is unchanged", () => {
    const { unmount } = render(<TipCard tip={healthTips[0]!} />);
    expect(screen.queryByText(/min read/)).not.toBeInTheDocument();
    unmount();
    render(<TipCard tip={healthTips[0]!} showMeta />);
    expect(screen.getByText(/\d min read/)).toBeInTheDocument();
    expect(screen.getByText("Sample")).toBeInTheDocument();
  });
});

describe("TipBrowser", () => {
  it("shows every article with category, Sample label and reading time", () => {
    render(<TipBrowser tips={healthTips} categories={categories} />);
    expect(cards()).toHaveLength(healthTips.length);
    expect(screen.getAllByText("Sample")).toHaveLength(healthTips.length);
    expect(screen.getAllByText(/\d min read/)).toHaveLength(healthTips.length);
    expect(screen.getByRole("status")).toHaveTextContent(`Showing all ${healthTips.length} articles`);
  });

  it("filters by a category chip, marks it pressed and keeps it in the URL", async () => {
    render(<TipBrowser tips={healthTips} categories={categories} />);
    await userEvent.click(screen.getByRole("button", { name: "Nutrition (2)" }));
    expect(screen.getByRole("button", { name: "Nutrition (2)" })).toHaveAttribute("aria-pressed", "true");
    expect(cards()).toHaveLength(2);
    expect(screen.getByRole("status")).toHaveTextContent(`Showing 2 of ${healthTips.length} articles`);
    expect(window.location.search).toBe("?category=nutrition");
    await userEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(cards()).toHaveLength(healthTips.length);
    expect(window.location.search).toBe("");
  });

  it("starts from the URL and ignores unknown categories", () => {
    search = "category=mental-wellbeing";
    const { unmount } = render(<TipBrowser tips={healthTips} categories={categories} />);
    expect(cards()).toHaveLength(1);
    unmount();
    search = "category=nope";
    render(<TipBrowser tips={healthTips} categories={categories} />);
    expect(cards()).toHaveLength(healthTips.length);
  });

  it("fallback renders every article under the same chips", () => {
    render(<TipBrowserFallback tips={healthTips} categories={categories} />);
    expect(cards()).toHaveLength(healthTips.length);
    expect(screen.getByRole("button", { name: `All (${healthTips.length})` })).toHaveAttribute("aria-pressed", "true");
  });
});

describe("ArticleBody and MedicalNote", () => {
  it("renders headings, paragraphs and lists as h2, p and ul, and treats text as text", () => {
    const { container } = render(
      <ArticleBody
        blocks={[
          { type: "heading", text: "A heading" },
          { type: "paragraph", text: "<b>not bold</b>" },
          { type: "list", items: ["one", "two"] },
        ]}
      />,
    );
    expect(screen.getByRole("heading", { level: 2, name: "A heading" })).toBeInTheDocument();
    expect(screen.getByText("<b>not bold</b>")).toBeInTheDocument();
    expect(container.querySelector("b")).toBeNull();
    expect(within(screen.getByRole("list")).getAllByRole("listitem")).toHaveLength(2);
  });

  it("states that the article is general information, not medical advice", () => {
    render(<MedicalNote />);
    expect(screen.getByText("General information, not medical advice.")).toBeInTheDocument();
  });
});
