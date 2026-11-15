// Portfolio assets (owner 2026-11-15): gallery images and the demo video draft, captured from the local production build
// against the mock API (sample data, nothing real, no bookings in any real database). Never part of the suite or CI:
//   ASSISTANT_ENABLED=true VOICE_ENABLED=true DEMO_ENABLED=true npx playwright test -c playwright.marketing.config.ts
import { defineConfig } from "@playwright/test";

import base from "./playwright.config";

export default defineConfig({
  ...base,
  testDir: "./tests/marketing",
  testIgnore: [],
  testMatch: /.*\.spec\.ts$/,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  projects: [{ name: "marketing", use: { browserName: "chromium", locale: "en-US" } }],
});
