import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

// npm run test always runs from frontend/.
const ROOT = process.cwd();
const read = (path: string) => readFileSync(join(ROOT, path), "utf8");

const css = read("src/app/globals.css");

/** Colour tokens declared in globals.css, for example { "navy-900": "#0b2545" }. */
const tokens: Record<string, string> = {};
for (const match of css.matchAll(/--color-([a-z0-9-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)) {
  tokens[match[1] as string] = (match[2] as string).toLowerCase();
}

function luminance(hex: string): number {
  const channels = [1, 3, 5].map((start) => {
    const value = parseInt(hex.slice(start, start + 2), 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * (channels[0] as number) + 0.7152 * (channels[1] as number) + 0.0722 * (channels[2] as number);
}

function contrast(foreground: string, background: string): number {
  const a = luminance(tokens[foreground] as string);
  const b = luminance(tokens[background] as string);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

function sourceFiles(dir: string, extensions: string[]): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(join(ROOT, dir))) {
    const path = join(dir, entry);
    if (statSync(join(ROOT, path)).isDirectory()) files.push(...sourceFiles(path, extensions));
    else if (extensions.some((extension) => entry.endsWith(extension))) files.push(path);
  }
  return files;
}

describe("brand tokens", () => {
  it("uses the exact brand colours from the brief", () => {
    expect(tokens["navy-900"]).toBe("#0b2545");
    expect(tokens["teal-500"]).toBe("#14b8a6");
    expect(tokens["muted"]).toBe("#5b6b7f");
  });

  it("drops Tailwind's default palette so only brand colours exist", () => {
    expect(css).toMatch(/--color-\*:\s*initial;/);
  });

  it("maps both fonts through next/font variables", () => {
    const layout = read("src/app/(site)/layout.tsx");
    expect(layout).toMatch(/Plus_Jakarta_Sans/);
    expect(layout).toMatch(/--font-jakarta/);
    expect(layout).toMatch(/Inter\(/);
    expect(layout).toMatch(/--font-inter/);
    expect(css).toMatch(/--font-heading:\s*var\(--font-jakarta\)/);
    expect(css).toMatch(/--font-sans:\s*var\(--font-inter\)/);
  });

  it("styles headings in navy and the body in Inter via the tokens", () => {
    expect(css).toMatch(/h1,[\s\S]*?\{[\s\S]*?color:\s*var\(--color-navy-900\)/);
    expect(css).toMatch(/font-family:\s*var\(--font-heading\)/);
    expect(css).toMatch(/font-family:\s*var\(--font-sans\)/);
  });

  it("keeps the browser theme colour and the touch icon colours in sync with the tokens", () => {
    expect(read("src/app/theme-color.ts").toLowerCase()).toContain(tokens["navy-900"]);
    const apple = read("src/app/apple-icon.tsx").toLowerCase();
    expect(apple).toContain(tokens["navy-900"]);
    expect(apple).toContain(tokens["teal-500"]);
    const share = read("src/lib/og.tsx").toLowerCase();
    expect(share).toContain(tokens["navy-900"]);
    expect(share).toContain(tokens["teal-500"]);
    expect(share).toContain(tokens["teal-700"]);
    const icon = read("src/app/icon.svg").toLowerCase();
    expect(icon).toContain(tokens["navy-900"]);
    expect(icon).toContain(tokens["teal-500"]);
  });
});

describe("WCAG 2.2 AA contrast of approved pairs", () => {
  const textPairs: Array<[string, string, number]> = [
    ["navy-900", "background", 7],
    ["navy-900", "surface", 7],
    ["navy-900", "teal-50", 7],
    ["ink", "background", 7],
    ["ink", "surface", 7],
    ["muted", "background", 4.5],
    ["muted", "surface", 4.5],
    ["muted", "teal-50", 4.5],
    ["teal-700", "background", 4.5],
    ["teal-700", "teal-50", 4.5],
    ["teal-700", "surface", 4.5],
    ["navy-900", "teal-500", 4.5],
    ["navy-900", "sky-400", 4.5],
    ["white", "navy-900", 7],
    ["white", "navy-800", 4.5],
    ["white", "blue-700", 4.5],
    ["white", "danger-700", 4.5],
    ["danger-700", "background", 4.5],
    ["danger-700", "danger-50", 4.5],
    ["teal-300", "navy-900", 4.5],
    ["teal-500", "navy-900", 4.5],
  ];

  it.each(textPairs)("%s on %s is at least %s:1", (foreground, background, minimum) => {
    expect(contrast(foreground, background)).toBeGreaterThanOrEqual(minimum);
  });

  const uiPairs: Array<[string, string, number]> = [
    ["border-strong", "background", 3],
    ["teal-600", "background", 3], // wordmark "Health" and the active-link bar
    ["blue-700", "background", 3], // focus ring on light surfaces
    ["blue-700", "surface", 3],
    ["teal-300", "navy-900", 3], // focus ring on navy
  ];

  it.each(uiPairs)("UI colour %s on %s is at least %s:1", (foreground, background, minimum) => {
    expect(contrast(foreground, background)).toBeGreaterThanOrEqual(minimum);
  });

  it("documents why brand teal is never used as text on white", () => {
    expect(contrast("teal-500", "background")).toBeLessThan(3);
  });
});

describe("source guardrails", () => {
  const ALLOWED_HEX_FILES = new Set([
    "src/app/globals.css",
    "src/app/icon.svg",
    "src/app/apple-icon.tsx",
    "src/lib/og.tsx",
    "src/app/theme-color.ts",
  ]);

  const files = [...sourceFiles("src", [".ts", ".tsx", ".css", ".svg"])].map((path) => path.split("\\").join("/"));

  it("has no hex colour outside globals.css and the icon files", () => {
    const offenders = files
      .filter((file) => !ALLOWED_HEX_FILES.has(file))
      .filter((file) => /#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/.test(readFileSync(join(ROOT, file), "utf8")))
      .map((file) => relative(".", file));
    expect(offenders).toEqual([]);
  });

  it("never uses brand teal or sky as text colour (2.5:1 on white)", () => {
    const offenders = files
      .filter((file) => /\.(tsx|ts)$/.test(file))
      .filter((file) => /\btext-(teal-(400|500)|sky-400)\b/.test(readFileSync(join(ROOT, file), "utf8")));
    expect(offenders).toEqual([]);
  });

  it("has no raw <img> element (everything goes through next/image)", () => {
    const offenders = files
      .filter((file) => file.endsWith(".tsx"))
      .filter((file) => /<img[\s>]/.test(readFileSync(join(ROOT, file), "utf8")));
    expect(offenders).toEqual([]);
  });
});
