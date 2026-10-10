// Fails only on high or critical npm advisories that are not in audit-allowlist.json.
// A package that is vulnerable only because it depends on an allow-listed package passes too.
// Usage: node scripts/check-audit.mjs   (reads `npm audit --json`; prints package names and advisory ids only)
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const SEVERE = new Set(["high", "critical"]);
const allowlist = JSON.parse(readFileSync(new URL("../audit-allowlist.json", import.meta.url), "utf8"));
const allowed = new Map(allowlist.advisories.map((entry) => [entry.id, entry]));

function readAudit() {
  // `npm audit` exits non-zero when it finds anything, so take the output either way.
  try {
    return execFileSync("npm", ["audit", "--json"], { encoding: "utf8", shell: process.platform === "win32" });
  } catch (error) {
    if (typeof error.stdout === "string" && error.stdout.trim().startsWith("{")) return error.stdout;
    throw error;
  }
}

const report = JSON.parse(readAudit());
if (report.error) {
  console.error(`npm audit failed: ${report.error.code ?? "unknown error"}`);
  process.exit(2);
}
const vulnerabilities = report.vulnerabilities ?? {};

// The advisories that ultimately cause a package to be flagged (following `via` chains).
function rootAdvisories(name, seen = new Set()) {
  if (seen.has(name)) return [];
  seen.add(name);
  const entry = vulnerabilities[name];
  if (!entry) return [];
  const roots = [];
  for (const via of entry.via) {
    if (typeof via === "string") roots.push(...rootAdvisories(via, seen));
    else roots.push({ id: via.url?.split("/").pop() ?? String(via.source), severity: via.severity, package: via.name });
  }
  return roots;
}

const failures = [];
const accepted = new Set();
for (const [name, entry] of Object.entries(vulnerabilities)) {
  if (!SEVERE.has(entry.severity)) continue;
  const roots = rootAdvisories(name).filter((root) => SEVERE.has(root.severity));
  const unlisted = roots.filter((root) => !allowed.has(root.id));
  if (roots.length === 0 || unlisted.length > 0) {
    failures.push(`${name} (${entry.severity}): ${(unlisted.length ? unlisted : roots).map((r) => r.id).join(", ") || "no advisory found"}`);
  } else {
    for (const root of roots) accepted.add(root.id);
  }
}

const today = new Date().toISOString().slice(0, 10);
for (const id of accepted) {
  const entry = allowed.get(id);
  const overdue = entry.reviewBy && entry.reviewBy < today ? " (REVIEW OVERDUE)" : "";
  console.log(`allow-listed: ${id} in ${entry.package}, reviewed ${entry.reviewDate}${overdue}`);
}
if (failures.length > 0) {
  console.error("High or critical advisories that are not allow-listed:");
  for (const line of failures) console.error(`  ${line}`);
  process.exit(1);
}
console.log("npm audit: no high or critical advisories outside the allow-list.");
