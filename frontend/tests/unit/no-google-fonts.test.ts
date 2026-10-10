// @vitest-environment node
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const SRC = resolve(__dirname, "../../src");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx|css)$/.test(name) ? [path] : [];
  });
}

describe("fonts are self-hosted", () => {
  it("no source file imports next/font/google or links fonts.googleapis.com", () => {
    const offenders = sourceFiles(SRC).filter((file) => /from\s+["']next\/font\/google["']|fonts\.googleapis\.com/.test(readFileSync(file, "utf8")));
    expect(offenders).toEqual([]);
  });

  it("the committed font files exist", () => {
    const names = readdirSync(join(SRC, "fonts")).filter((name) => name.endsWith(".woff2"));
    expect(names.sort()).toEqual([
      "cormorant-garamond-latin-variable.woff2",
      "inter-latin-variable.woff2",
      "plus-jakarta-sans-latin-variable.woff2",
    ]);
  });
});
