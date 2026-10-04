import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LabTestBrowser, LabTestBrowserFallback } from "@/components/lab-tests/LabTestBrowser";
import { labTestCategories, labTests } from "../fixtures/catalog/labTests";

let search = "";
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(search),
}));

const cards = () => screen.queryAllByRole("article");
const chip = (name: RegExp | string) => screen.getByRole("button", { name });

beforeEach(() => {
  search = "";
  window.history.replaceState(null, "", "/lab-tests");
});

describe("LabTestBrowser", () => {
  it("shows every test with its price labelled as a sample price", () => {
    render(<LabTestBrowser tests={labTests} categories={labTestCategories} />);
    expect(cards()).toHaveLength(labTests.length);
    expect(screen.getAllByText("Sample price")).toHaveLength(labTests.length);
    expect(screen.getByRole("status")).toHaveTextContent(`Showing all ${labTests.length} lab tests`);
  });

  it("shows name, aliases, price, sample, report time, preparation and home collection on a card", () => {
    render(<LabTestBrowser tests={labTests} categories={labTestCategories} />);
    const card = cards().find((candidate) => within(candidate).queryByText("Complete Blood Count (CBC)")) as HTMLElement;
    expect(within(card).getByRole("link", { name: "Complete Blood Count (CBC)" })).toHaveAttribute("href", "/lab-tests/complete-blood-count");
    expect(within(card).getByText(/Also known as: CBC, Complete blood picture, CBP/)).toBeInTheDocument();
    expect(within(card).getByText("PKR 800")).toBeInTheDocument();
    expect(within(card).getByText("Same day")).toBeInTheDocument();
    expect(within(card).getByText("No preparation needed")).toBeInTheDocument();
    expect(within(card).getByText("Home collection").nextElementSibling).toHaveTextContent("Yes");
  });

  it("searches by test name, case-insensitively", async () => {
    render(<LabTestBrowser tests={labTests} categories={labTestCategories} />);
    await userEvent.type(screen.getByLabelText("Search tests"), "  CBC ");
    expect(cards()).toHaveLength(1);
    expect(screen.getByRole("heading", { level: 3, name: "Complete Blood Count (CBC)" })).toBeInTheDocument();
    expect(window.location.search).toBe("?q=CBC");
  });

  it("searches the also-known-as names too", async () => {
    render(<LabTestBrowser tests={labTests} categories={labTestCategories} />);
    await userEvent.type(screen.getByLabelText("Search tests"), "sugar");
    // Fasting and Random Blood Sugar by name, HbA1c by "Average sugar test".
    expect(cards()).toHaveLength(3);
    await userEvent.clear(screen.getByLabelText("Search tests"));
    await userEvent.type(screen.getByLabelText("Search tests"), "glycated");
    expect(screen.getByRole("heading", { level: 3, name: "HbA1c" })).toBeInTheDocument();
    expect(cards()).toHaveLength(1);
  });

  it("has a chip per category with its count and marks the chosen one with aria-pressed", async () => {
    render(<LabTestBrowser tests={labTests} categories={labTestCategories} />);
    expect(chip(`All (${labTests.length})`)).toHaveAttribute("aria-pressed", "true");
    for (const category of labTestCategories) {
      const count = labTests.filter((test) => test.categoryId === category.id).length;
      expect(chip(`${category.name} (${count})`)).toHaveAttribute("aria-pressed", "false");
    }
    await userEvent.click(chip(/^Heart \(/));
    expect(chip(/^Heart \(/)).toHaveAttribute("aria-pressed", "true");
    expect(chip(/^All \(/)).toHaveAttribute("aria-pressed", "false");
    expect(cards()).toHaveLength(labTests.filter((test) => test.categoryId === "cat-heart").length);
    expect(screen.getByRole("status")).toHaveTextContent(/^Showing 2 of \d+ lab tests$/);
    expect(window.location.search).toBe("?category=heart");
  });

  it("combines the category chip with the search", async () => {
    render(<LabTestBrowser tests={labTests} categories={labTestCategories} />);
    await userEvent.type(screen.getByLabelText("Search tests"), "sugar");
    await userEvent.click(chip(/^Blood \(/));
    expect(cards()).toHaveLength(0);
    expect(screen.getByText("No lab tests match your search")).toBeInTheDocument();
    await userEvent.click(chip(/^Diabetes \(/));
    expect(cards()).toHaveLength(3);
  });

  it("shows the empty state, and Clear filters restores the whole catalog", async () => {
    render(<LabTestBrowser tests={labTests} categories={labTestCategories} />);
    await userEvent.type(screen.getByLabelText("Search tests"), "zzzz");
    expect(screen.queryAllByRole("article")).toHaveLength(0);
    expect(screen.getByText("No lab tests match your search")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(`Showing 0 of ${labTests.length} lab tests`);
    await userEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(cards()).toHaveLength(labTests.length);
    expect(screen.getByLabelText("Search tests")).toHaveValue("");
    expect(window.location.search).toBe("");
  });

  it("starts from the filters in the URL and ignores unknown values", () => {
    search = "category=thyroid&q=tsh";
    const { unmount } = render(<LabTestBrowser tests={labTests} categories={labTestCategories} />);
    expect(chip(/^Thyroid \(/)).toHaveAttribute("aria-pressed", "true");
    expect(cards().length).toBeGreaterThan(0);
    unmount();

    search = "category=nope";
    render(<LabTestBrowser tests={labTests} categories={labTestCategories} />);
    expect(cards()).toHaveLength(labTests.length);
  });
});

describe("LabTestBrowserFallback", () => {
  it("renders the full catalog under the same controls, for the server and for no-JavaScript visitors", () => {
    render(<LabTestBrowserFallback tests={labTests} categories={labTestCategories} />);
    expect(cards()).toHaveLength(labTests.length);
    expect(screen.getByLabelText("Search tests")).toBeInTheDocument();
    expect(chip(/^All \(/)).toHaveAttribute("aria-pressed", "true");
  });
});
