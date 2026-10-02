import { render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { Logo } from "@/components/brand/Logo";
import { LogoMark } from "@/components/brand/LogoMark";
import { PLUS_PATH, PULSE_PATH, PULSE_STROKE_WIDTH } from "@/components/brand/logo-paths";

// npm run test always runs from frontend/.
const ROOT = process.cwd();

describe("Logo", () => {
  it("renders the wordmark as real text, Shuaib in navy and Health in teal", () => {
    render(<Logo />);
    expect(screen.getByText("Shuaib")).toHaveClass("text-navy-900");
    expect(screen.getByText("Health")).toHaveClass("text-teal-600");
  });

  it("uses lighter wordmark colours on navy backgrounds", () => {
    render(<Logo onDark />);
    expect(screen.getByText("Shuaib")).toHaveClass("text-white");
    expect(screen.getByText("Health")).toHaveClass("text-teal-300");
  });

  it("renders only the mark for the mark variant", () => {
    const { container } = render(<Logo variant="mark" />);
    expect(container.querySelector("svg")).not.toBeNull();
    expect(screen.queryByText("Shuaib")).toBeNull();
  });
});

describe("LogoMark", () => {
  it("is hidden from assistive technology", () => {
    const { container } = render(<LogoMark />);
    expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });

  it("draws the plus and the heartbeat line from the shared path constants", () => {
    const { container } = render(<LogoMark />);
    const paths = [...container.querySelectorAll("path")].map((path) => path.getAttribute("d"));
    expect(paths).toEqual([PLUS_PATH, PULSE_PATH]);
  });

  it("gives every instance its own gradient id", () => {
    const { container } = render(
      <>
        <LogoMark />
        <LogoMark />
      </>,
    );
    const ids = [...container.querySelectorAll("linearGradient")].map((gradient) => gradient.id);
    expect(ids).toHaveLength(2);
    expect(new Set(ids).size).toBe(2);
    for (const fill of [...container.querySelectorAll("path[fill^='url']")].map((p) => p.getAttribute("fill"))) {
      expect(ids.some((id) => fill === `url(#${id})`)).toBe(true);
    }
  });

  it("uses CSS tokens for its colours, never hex values", () => {
    const { container } = render(<LogoMark />);
    expect(container.innerHTML).not.toMatch(/#[0-9a-fA-F]{3,6}\b(?!\))/);
    expect(container.innerHTML).toContain("var(--color-teal-500)");
    expect(container.innerHTML).toContain("var(--color-navy-900)");
  });
});

describe("favicon", () => {
  const icon = readFileSync(join(ROOT, "src/app/icon.svg"), "utf8");

  it("is drawn from the same path data as the logo component", () => {
    expect(icon).toContain(`d="${PLUS_PATH}"`);
    expect(icon).toContain(`d="${PULSE_PATH}"`);
    expect(icon).toContain(`stroke-width="${PULSE_STROKE_WIDTH}"`);
  });
});
