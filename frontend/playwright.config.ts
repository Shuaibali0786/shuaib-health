import { readFileSync } from "node:fs";

import { defineConfig, devices } from "@playwright/test";

const PROXY_SECRET = "fake-e2e-proxy-secret-not-real-000000"; // obviously fake, test servers only

const PORT = 3100;
const MOCK_PORT = 4010;

// The recorded clinic settings, as the server-side fallback for the emergency number.
const clinicFallback = JSON.stringify(JSON.parse(readFileSync("tests/fixtures/api/clinic.json", "utf8")));

const ADMIN_SPECS = /admin-.*\.spec\.ts$/;
const ADMIN_IGNORE = ["**/stateful/**", "**/offline/**"];

// Main config: production build against the mock API in "ok" mode. Specs here never switch modes,
// so they can run fully parallel. Mode-switching specs live in tests/e2e/stateful (own config) and
// API-less builds in tests/e2e/offline (own config).
export default defineConfig({
  testDir: "./tests/e2e",
  // Staff-app specs (Feature 006) run only in the admin-* projects below.
  testIgnore: ["**/stateful/**", "**/offline/**", "**/admin-*.spec.ts"],
  globalSetup: "./tests/e2e/global-setup.ts",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "on-first-retry",
  },
  projects: [
    { name: "mobile", use: { ...devices["Pixel 7"] } },
    // iPhone Safari (WebKit). Only the confirmation slip needs it, so the rest of the suite stays on Chromium.
    { name: "iphone", testMatch: /confirmation-slip\.spec\.ts/, use: { ...devices["iPhone 14"] } },
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } },
    },
    // Command Centre (Feature 006). Only tests/e2e/admin-*.spec.ts; the public projects above ignore them.
    {
      name: "admin-desktop",
      testMatch: ADMIN_SPECS,
      testIgnore: ADMIN_IGNORE,
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
    },
    {
      name: "admin-laptop-1366",
      testMatch: ADMIN_SPECS,
      testIgnore: ADMIN_IGNORE,
      use: { ...devices["Desktop Chrome"], viewport: { width: 1366, height: 768 } },
    },
    {
      name: "admin-laptop-1280",
      testMatch: ADMIN_SPECS,
      testIgnore: ADMIN_IGNORE,
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } },
    },
    {
      name: "admin-mobile",
      testMatch: ADMIN_SPECS,
      testIgnore: ADMIN_IGNORE,
      use: { ...devices["Pixel 7"] },
    },
  ],
  webServer: [
    {
      command: "node tests/mock-api/server.mjs",
      url: `http://127.0.0.1:${MOCK_PORT}/`,
      env: { MOCK_API_PORT: String(MOCK_PORT), MOCK_API_MODE: "ok", MOCK_PROXY_SECRET: PROXY_SECRET },
      reuseExistingServer: !process.env.CI,
    },
    // Tests run against the production build, which is what ships.
    {
      command: `npm run build && npm run start -- --port ${PORT}`,
      url: `http://localhost:${PORT}`,
      timeout: 180_000,
      reuseExistingServer: !process.env.CI,
      env: {
        CATALOG_API_URL: `http://127.0.0.1:${MOCK_PORT}`,
        CLINIC_FALLBACK_JSON: clinicFallback,
        BOOKING_PROXY_SECRET: PROXY_SECRET,
      },
    },
  ],
});
