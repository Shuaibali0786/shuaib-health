import { readFileSync } from "node:fs";

import { defineConfig, devices } from "@playwright/test";

// Offline config: production builds made and served while the catalog API is dead or not configured.
// Each variant builds into its own folder so the two builds never share `.next`.
const clinicFallback = JSON.stringify(JSON.parse(readFileSync("tests/fixtures/api/clinic.json", "utf8")));

const DEAD_PORT = 3200;
const UNSET_PORT = 3201;

const desktop = { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } };

export default defineConfig({
  testDir: "./tests/e2e/offline",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  projects: [
    { name: "dead-desktop", testMatch: "site.spec.ts", use: { ...desktop, baseURL: `http://localhost:${DEAD_PORT}` } },
    { name: "dead-mobile", testMatch: "site.spec.ts", use: { ...devices["Pixel 7"], baseURL: `http://localhost:${DEAD_PORT}` } },
    { name: "unset-desktop", testMatch: "unset.spec.ts", use: { ...desktop, baseURL: `http://localhost:${UNSET_PORT}` } },
    { name: "unset-mobile", testMatch: "unset.spec.ts", use: { ...devices["Pixel 7"], baseURL: `http://localhost:${UNSET_PORT}` } },
  ],
  webServer: [
    {
      // Nothing listens on port 9, so every API call is refused.
      command: `npm run build && npm run start -- --port ${DEAD_PORT}`,
      url: `http://localhost:${DEAD_PORT}`,
      timeout: 240_000,
      reuseExistingServer: false,
      env: {
        NEXT_DIST_DIR: ".next-offline-dead",
        CATALOG_API_URL: "http://127.0.0.1:9",
        CLINIC_FALLBACK_JSON: clinicFallback,
      },
    },
    {
      // Both variables empty, which the data layer treats as unset.
      command: `npm run build && npm run start -- --port ${UNSET_PORT}`,
      url: `http://localhost:${UNSET_PORT}`,
      timeout: 240_000,
      reuseExistingServer: false,
      env: {
        NEXT_DIST_DIR: ".next-offline-unset",
        CATALOG_API_URL: "",
        CLINIC_FALLBACK_JSON: "",
      },
    },
  ],
});
