import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SwipeList } from "@/components/ui/SwipeList";

/**
 * jsdom has no layout, so the measurements a browser would give are set by hand:
 * a 390 px wide row holding three 295 px cards (16 px padding, 16 px gaps).
 */
function setup({ scrollWidth = 1000, scrollLeft = 0 } = {}) {
  render(
    <SwipeList>
      {[0, 1, 2].map((index) => (
        <li key={index}>
          <a href={`/card-${index}`}>Card {index}</a>
        </li>
      ))}
    </SwipeList>,
  );
  const row = screen.getByRole("list");
  const scrollTo = vi.fn();
  Object.assign(row, { scrollTo });
  Object.defineProperty(row, "scrollWidth", { value: scrollWidth, configurable: true });
  Object.defineProperty(row, "clientWidth", { value: 390, configurable: true });
  Object.defineProperty(row, "scrollLeft", { value: scrollLeft, configurable: true });
  row.style.paddingLeft = "16px";
  screen.getAllByRole("listitem").forEach((item, index) => {
    Object.defineProperty(item, "offsetLeft", { value: 16 + index * 311, configurable: true });
    Object.defineProperty(item, "offsetWidth", { value: 295, configurable: true });
  });
  return { row, scrollTo };
}

describe("SwipeList", () => {
  it("scrolls a card that is mostly off screen fully into view when its link gets keyboard focus", () => {
    const { scrollTo } = setup();
    fireEvent.focus(screen.getByRole("link", { name: "Card 2" }));
    // Card 2 starts at 16 + 2 * 311 = 638; with the 16 px row padding the row should scroll to 622.
    expect(scrollTo).toHaveBeenCalledWith({ left: 622 });
  });

  it("does nothing when the focused card is already fully in view", () => {
    const { scrollTo } = setup();
    fireEvent.focus(screen.getByRole("link", { name: "Card 0" }));
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it("does nothing when the list is not scrollable (the grid layout from sm up)", () => {
    const { scrollTo } = setup({ scrollWidth: 390 });
    fireEvent.focus(screen.getByRole("link", { name: "Card 2" }));
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it("renders a plain list of its children and passes the class name through", () => {
    render(
      <SwipeList className="swipe">
        <li>One</li>
      </SwipeList>,
    );
    expect(screen.getByRole("list")).toHaveClass("swipe");
    expect(screen.getByText("One")).toBeInTheDocument();
  });
});
