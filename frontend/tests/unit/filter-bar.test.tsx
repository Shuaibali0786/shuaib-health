import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { EmptyState } from "@/components/ui/EmptyState";
import { ChipGroup, FilterBar, ResultCount, SearchField, SelectField } from "@/components/ui/FilterBar";

describe("FilterBar controls", () => {
  it("labels the search landmark and every control", () => {
    render(
      <FilterBar label="Filter doctors">
        <SearchField id="q" label="Search by name" value="" onChange={() => {}} />
        <SelectField id="d" label="Department" value="" onChange={() => {}} options={[{ value: "", label: "All departments" }]} />
      </FilterBar>,
    );
    expect(screen.getByRole("search", { name: "Filter doctors" })).toBeInTheDocument();
    expect(screen.getByLabelText("Search by name")).toHaveAttribute("type", "search");
    expect(screen.getByLabelText("Department")).toBeInTheDocument();
  });

  it("reports typing and selection through onChange", async () => {
    const onSearch = vi.fn();
    const onSelect = vi.fn();
    render(
      <>
        <SearchField id="q" label="Search" value="" onChange={onSearch} />
        <SelectField
          id="d"
          label="Day"
          value=""
          onChange={onSelect}
          options={[
            { value: "", label: "Any day" },
            { value: "mon", label: "Monday" },
          ]}
        />
      </>,
    );
    await userEvent.type(screen.getByLabelText("Search"), "s");
    expect(onSearch).toHaveBeenCalledWith("s");
    await userEvent.selectOptions(screen.getByLabelText("Day"), "mon");
    expect(onSelect).toHaveBeenCalledWith("mon");
  });

  it("marks the selected chip with aria-pressed", async () => {
    const onChange = vi.fn();
    render(
      <ChipGroup
        label="Category"
        value="heart"
        onChange={onChange}
        options={[
          { value: "", label: "All" },
          { value: "heart", label: "Heart", count: 2 },
        ]}
      />,
    );
    expect(screen.getByRole("group", { name: "Category" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Heart (2)" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "All" })).toHaveAttribute("aria-pressed", "false");
    await userEvent.click(screen.getByRole("button", { name: "All" }));
    expect(onChange).toHaveBeenCalledWith("");
  });
});

describe("ResultCount", () => {
  it("is a polite live region and states the counts", () => {
    const { rerender } = render(<ResultCount shown={9} total={9} noun="doctors" />);
    expect(screen.getByRole("status")).toHaveTextContent("Showing all 9 doctors");
    expect(screen.getByRole("status")).toHaveAttribute("aria-live", "polite");
    rerender(<ResultCount shown={2} total={9} noun="doctors" />);
    expect(screen.getByRole("status")).toHaveTextContent("Showing 2 of 9 doctors");
  });
});

describe("EmptyState", () => {
  it("shows the message and a working clear button", async () => {
    const onClear = vi.fn();
    render(<EmptyState title="No doctors match your filters" onClear={onClear} />);
    expect(screen.getByText("No doctors match your filters")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(onClear).toHaveBeenCalledOnce();
  });

  it("omits the button when there is nothing to clear", () => {
    render(<EmptyState title="Nothing here" />);
    expect(screen.queryByRole("button")).toBeNull();
  });
});
