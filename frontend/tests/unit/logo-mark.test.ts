import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { LOGO_VIEWBOX, PLUS_PATH, PULSE_PATH } from "@/components/brand/logo-paths";
// Plain JS helper in scripts/; Node's type stripping loads logo-paths.ts when the script runs.
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
    expect(svg.getAttribute("viewBox")).toBe(`0 0 ${LOGO_VIEWBOX} ${LOGO_VIEWBOX}`);
    expect(svg.getAttribute("role")).toBe("img");
    expect(doc.getElementsByTagName("title")[0]?.textContent).toBe("Logo mark");
  });

  it("uses exactly the path data the LogoMark component uses", () => {
    const doc = new DOMParser().parseFromString(readFileSync(FILE, "utf8"), "image/svg+xml");
    const paths = [...doc.getElementsByTagName("path")].map((path) => path.getAttribute("d"));
    expect(paths).toEqual([PLUS_PATH, PULSE_PATH]);
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
