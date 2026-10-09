import { render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { Logo } from "@/components/brand/Logo";
import { LogoMark } from "@/components/brand/LogoMark";
import { PoweredBy } from "@/components/brand/PoweredBy";
import { MARK_COLOURS, MARK_LARGE, MARK_SMALL, WORDMARK_COLOURS } from "@/lib/brand-marks";

// npm run test always runs from frontend/.
const ROOT = process.cwd();

/** jsdom turns "#0B1F3A" into rgb(...); compare in that form. */
const rgb = (hex: string) => `rgb(${[1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(", ")})`;
const fills = (container: HTMLElement) => [...container.querySelectorAll("rect")].map((r) => (r as SVGRectElement).style.fill);
const expected = (tone: keyof typeof MARK_COLOURS) => MARK_LARGE.map((r) => rgb(MARK_COLOURS[tone][r.part]));
const words = (container: HTMLElement) => [...container.querySelectorAll("[data-wordmark] path")] as SVGPathElement[];

describe("Logo", () => {
  it("draws mark and wordmark as decorative SVG, so nothing is read twice by a screen reader", () => {
    const { container } = render(<Logo />);
    const svgs = container.querySelectorAll("svg");
    expect(svgs).toHaveLength(2);
    for (const svg of svgs) expect(svg).toHaveAttribute("aria-hidden", "true");
    expect(container.textContent).toBe("");
  });

  it("light variant: navy body, gold rings, teal plus, navy Shuaib and teal Health", () => {
    const { container } = render(<Logo variant="light" />);
    expect(fills(container)).toEqual(expected("light"));
    const [shuaib, health] = words(container);
    expect(shuaib?.style.fill).toBe(rgb(WORDMARK_COLOURS.light.shuaib));
    expect(health?.style.fill).toBe(rgb(WORDMARK_COLOURS.light.health));
  });

  it("night variant: cream body, deeper teal plus, white Shuaib and light-teal Health", () => {
    const { container } = render(<Logo variant="night" />);
    expect(fills(container)).toEqual(expected("night"));
    const [shuaib, health] = words(container);
    expect(shuaib?.style.fill).toBe(rgb("#FFFFFF"));
    expect(health?.style.fill).toBe(rgb("#5FD0C5"));
  });

  it("one-colour variant: navy body and rings, white plus", () => {
    const { container } = render(<Logo variant="one-colour" wordmark={false} />);
    expect(fills(container)).toEqual(expected("one-colour"));
  });

  it("small variant uses the SMALL drawing, and so does any mark of 32 px or less", () => {
    const small = render(<Logo variant="small" wordmark={false} size="lg" />).container;
    expect(small.querySelectorAll("rect")[0]).toHaveAttribute("width", String(MARK_SMALL[0]?.width));
    const sm = render(<Logo size="sm" wordmark={false} />).container;
    expect(sm.querySelectorAll("rect")[0]).toHaveAttribute("width", String(MARK_SMALL[0]?.width));
    const md = render(<Logo size="md" wordmark={false} />).container;
    expect(md.querySelectorAll("rect")[0]).toHaveAttribute("width", String(MARK_LARGE[0]?.width));
  });

  it("can be shown without the wordmark", () => {
    const { container } = render(<Logo wordmark={false} />);
    expect(container.querySelectorAll("svg")).toHaveLength(1);
    expect(container.querySelector("[data-wordmark]")).toBeNull();
  });

  it("auto variant reads its colours from the --logo-* variables, falling back to the light colours", () => {
    const { container } = render(<Logo variant="auto" />);
    expect(container.innerHTML).toContain("var(--logo-body");
    expect(container.innerHTML).toContain("var(--logo-plus");
    expect(container.innerHTML).toContain("var(--logo-word");
  });
});

describe("LogoMark", () => {
  it("is hidden from assistive technology", () => {
    const { container } = render(<LogoMark />);
    expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });

  it("is never a red cross: no red in any tone", () => {
    for (const tone of ["light", "night", "one-colour"] as const) {
      for (const colour of Object.values(MARK_COLOURS[tone])) {
        const [r, g, b] = [1, 3, 5].map((i) => parseInt(colour.slice(i, i + 2), 16)) as [number, number, number];
        expect(r > 150 && g < 100 && b < 100, `${tone} ${colour}`).toBe(false);
      }
    }
  });
});

describe("PoweredBy", () => {
  it("reads 'Powered by Shuaib Health' with a decorative SMALL mark", () => {
    const { container } = render(<PoweredBy />);
    expect(screen.getByText("Powered by Shuaib Health")).toBeInTheDocument();
    expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
    expect(container.querySelectorAll("rect")[0]).toHaveAttribute("width", String(MARK_SMALL[0]?.width));
  });
});

describe("favicon", () => {
  const icon = readFileSync(join(ROOT, "src/app/icon.svg"), "utf8");

  it("is the SMALL drawing in the light colours, shape for shape", () => {
    for (const r of MARK_SMALL) {
      expect(icon).toContain(
        `<rect x="${r.x}" y="${r.y}" width="${r.width}" height="${r.height}" rx="${r.rx}" fill="${MARK_COLOURS.light[r.part]}"/>`,
      );
    }
  });
});
