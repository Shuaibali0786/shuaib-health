import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { MARK_COLOURS, MARK_LARGE, MARK_VIEWBOX } from "@/lib/brand-marks";
// Plain JS helper in scripts/; Node's type stripping loads brand-marks.ts when the script runs.
import { buildLogoSvg } from "../../scripts/build-logo-svg.mjs";

const FILE = join(process.cwd(), "public", "images", "brand", "logo-mark.svg");

describe("public/images/brand/logo-mark.svg", () => {
  it("exists, is small and parses as XML", () => {
    expect(existsSync(FILE)).toBe(true);
    expect(statSync(FILE).size).toBeLessThan(4 * 1024);
    const doc = new DOMParser().parseFromString(readFileSync(FILE, "utf8"), "image/svg+xml");
    expect(doc.getElementsByTagName("parsererror")).toHaveLength(0);
  });

  it("is an accessible vector: viewBox, a title and role=img", () => {
    const doc = new DOMParser().parseFromString(readFileSync(FILE, "utf8"), "image/svg+xml");
    const svg = doc.documentElement;
    expect(svg.tagName).toBe("svg");
    expect(svg.getAttribute("viewBox")).toBe(`0 0 ${MARK_VIEWBOX} ${MARK_VIEWBOX}`);
    expect(svg.getAttribute("role")).toBe("img");
    expect(doc.getElementsByTagName("title")[0]?.textContent).toBe("Logo mark");
  });

  it("draws exactly the shapes and light colours the LogoMark component uses", () => {
    const doc = new DOMParser().parseFromString(readFileSync(FILE, "utf8"), "image/svg+xml");
    const rects = [...doc.getElementsByTagName("rect")].map((r) => ({
      x: Number(r.getAttribute("x")),
      y: Number(r.getAttribute("y")),
      width: Number(r.getAttribute("width")),
      height: Number(r.getAttribute("height")),
      rx: Number(r.getAttribute("rx")),
      fill: r.getAttribute("fill"),
    }));
    expect(rects).toEqual(MARK_LARGE.map(({ part, ...shape }) => ({ ...shape, fill: MARK_COLOURS.light[part] })));
  });

  it("has no raster image, external reference or script", () => {
    const source = readFileSync(FILE, "utf8");
    expect(source).not.toMatch(/<image\b/i);
    expect(source).not.toMatch(/<script\b/i);
    expect(source).not.toMatch(/\bhref\s*=/i);
    expect(source).not.toMatch(/https?:\/\/(?!www\.w3\.org\/2000\/svg)/i);
  });

  it("is what scripts/build-logo-svg.mjs generates, so the file cannot drift from the component", () => {
    expect(readFileSync(FILE, "utf8").replace(/\r\n/g, "\n")).toBe(buildLogoSvg());
  });
});
