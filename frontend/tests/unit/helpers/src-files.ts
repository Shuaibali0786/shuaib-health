// Shared by the source-scanning guard tests: every .ts/.tsx file under src/, with comments blanked out.
import { readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const SRC = resolve(process.cwd(), "src");

export type SrcFile = { path: string; text: string; code: string };

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(join(dir, e.name)) : /\.tsx?$/.test(e.name) ? [join(dir, e.name)] : [],
  );
}

/** Replaces comments with spaces so that words in prose are not mistaken for code. Strings are left alone. */
export function stripComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\/|(^|[^:\\])\/\/[^\n]*/g, (m, lead) => (lead ?? "") + " ".repeat(m.length - (lead ?? "").length));
}

export function srcFiles(): SrcFile[] {
  return walk(SRC).map((file) => {
    const text = readFileSync(file, "utf8");
    return { path: relative(SRC, file).split("\\").join("/"), text, code: stripComments(text) };
  });
}
