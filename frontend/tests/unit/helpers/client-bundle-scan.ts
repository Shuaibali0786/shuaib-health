// Scans built browser bundles for the catalog API's address and settings (SC-006): the API URL and
// the server-only variables must never reach the browser. Used by a unit test and by Playwright's
// global setup, so it always runs after the e2e build.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/** Production build folders whose `static` directory is shipped to browsers. */
export const BUILD_FOLDERS = [".next", ".next-offline-dead", ".next-offline-unset"];

export const FORBIDDEN = [
  "127.0.0.1:4010",
  "127.0.0.1:4011",
  "127.0.0.1:4012",
  "localhost:8000",
  "CATALOG_API_URL",
  "CATALOG_DATA_REVALIDATE_SECONDS",
  "CLINIC_FALLBACK_JSON",
  "BOOKING_PROXY_SECRET",
  // The fake secret the e2e servers use (playwright*.config.ts).
  "fake-e2e-proxy-secret-not-real-000000",
];

function filesUnder(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    return statSync(path).isDirectory() ? filesUnder(path) : [path];
  });
}

/** Every "file: forbidden text" hit under the `static` folder of each build that exists. */
export function scanClientBundles(root = process.cwd()): { scanned: string[]; hits: string[] } {
  const scanned: string[] = [];
  const hits: string[] = [];
  for (const folder of BUILD_FOLDERS) {
    const staticDir = join(root, folder, "static");
    if (!existsSync(staticDir)) continue;
    scanned.push(folder);
    for (const file of filesUnder(staticDir)) {
      if (/\.(png|jpe?g|webp|avif|ico|woff2?|ttf)$/i.test(file)) continue;
      const text = readFileSync(file, "utf8");
      for (const needle of FORBIDDEN) if (text.includes(needle)) hits.push(`${file}: ${needle}`);
    }
  }
  return { scanned, hits };
}
