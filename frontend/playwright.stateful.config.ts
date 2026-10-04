import { readFileSync } from "node:fs";

import { defineConfig, devices } from "@playwright/test";

const PROXY_SECRET = "fake-e2e-proxy-secret-not-real-000000"; // obviously fake, test servers only

// Stateful config: specs that switch the mock API between modes. One worker, `next dev` with a 3 s
// data-cache window. Production pages are ISR with a literal `revalidate = 300`, so a production page
// never re-renders inside a test; `next dev` renders every request but still goes through
// `unstable_cache`, so a mode switch really reaches the data layer. Every spec asserts through the
// mock's request log that the API was called after the switch.
const clinicFallback = JSON.stringify(JSON.parse(readFileSync("tests/fixtures/api/clinic.json", "utf8")));

const WARM = { app: 3300, mock: 4011 };
const COLD = { app: 3301, mock: 4012 };

export default defineConfig({
  testDir: "./tests/e2e/stateful",
  workers: 1,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${WARM.app}`,
    trace: "on-first-retry",
  },
  projects: [{ name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } } }],
  webServer: [
    {
      command: "node tests/mock-api/server.mjs",
      url: `http://127.0.0.1:${WARM.mock}/`,
      env: { MOCK_API_PORT: String(WARM.mock), MOCK_API_MODE: "ok", MOCK_PROXY_SECRET: PROXY_SECRET },
      reuseExistingServer: false,
    },
    {
      command: `npm run dev -- --port ${WARM.app}`,
      url: `http://localhost:${WARM.app}`,
      timeout: 180_000,
      reuseExistingServer: false,
      env: {
        NEXT_DIST_DIR: ".next-stateful",
        CATALOG_API_URL: `http://127.0.0.1:${WARM.mock}`,
        CATALOG_DATA_REVALIDATE_SECONDS: "3",
        CLINIC_FALLBACK_JSON: clinicFallback,
        BOOKING_PROXY_SECRET: PROXY_SECRET,
      },
    },
    // Cold pair: a mock that starts in "partial" mode and a dev server whose build folder is emptied
    // first, so its data cache always starts empty. Only partial-cold.spec.ts uses it.
    {
      command: "node tests/mock-api/server.mjs",
      url: `http://127.0.0.1:${COLD.mock}/`,
      env: { MOCK_API_PORT: String(COLD.mock), MOCK_API_MODE: "partial", MOCK_PROXY_SECRET: PROXY_SECRET },
      reuseExistingServer: false,
    },
    {
      command: `node -e "require('fs').rmSync('.next-stateful-cold',{recursive:true,force:true})" && npm run dev -- --port ${COLD.app}`,
      url: `http://localhost:${COLD.app}`,
      timeout: 180_000,
      reuseExistingServer: false,
      env: {
        NEXT_DIST_DIR: ".next-stateful-cold",
        CATALOG_API_URL: `http://127.0.0.1:${COLD.mock}`,
        CATALOG_DATA_REVALIDATE_SECONDS: "3",
        CLINIC_FALLBACK_JSON: clinicFallback,
        BOOKING_PROXY_SECRET: PROXY_SECRET,
      },
    },
  ],
});
