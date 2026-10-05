import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const SRC = join(__dirname, "..", "..", "src");
const STALE = /not available in this demo|coming soon|holding page|collects no personal data|no booking forms/i;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx)$/.test(name) ? [path] : [];
  });
}

describe("site wording after booking went live as a demo (FR-056, SC-013)", () => {
  it("no source file still says booking is unavailable, coming soon or a holding page", () => {
    const hits = sourceFiles(SRC).filter((file) => STALE.test(readFileSync(file, "utf8")));
    expect(hits).toEqual([]);
  });
});
