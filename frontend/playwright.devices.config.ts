// Feature 013, owner request 2026-11-09 (Part C): the A-Z check on every device, in the three browser engines
// (Chromium for Chrome/Edge/Android, WebKit for Safari/iPhone/iPad, Firefox). Local only (not in CI): it is long and
// heavy. Same production build and mock API as the main suite.
//
// Run: ASSISTANT_ENABLED=true VOICE_ENABLED=true npx playwright test -c playwright.devices.config.ts --workers=1
import { defineConfig, devices } from "@playwright/test";

import base from "./playwright.config";

const desktop = (width: number, height: number) => ({ viewport: { width, height }, deviceScaleFactor: 1, isMobile: false, hasTouch: false });

export default defineConfig({
  ...base,
  testDir: "./tests/e2e/devices",
  testIgnore: [],
  testMatch: /.*\.spec\.ts$/,
  fullyParallel: false,
  retries: 0,
  reporter: [["list"], ["json", { outputFile: "test-results/device-matrix.json" }]],
  use: { ...base.use, trace: "off" },
  projects: [
    { name: "android-360 · chromium", use: { ...devices["Galaxy S8"], viewport: { width: 360, height: 800 } } },
    { name: "android-360 · firefox", use: { browserName: "firefox", viewport: { width: 360, height: 800 }, deviceScaleFactor: 2, hasTouch: true } },
    { name: "pixel-7 · chromium", use: { ...devices["Pixel 7"] } },
    { name: "iphone-se · webkit", use: { ...devices["iPhone SE"] } },
    { name: "iphone-15 · webkit", use: { ...devices["iPhone 15"] } },
    { name: "ipad · webkit", use: { ...devices["iPad (gen 7)"] } },
    { name: "ipad-landscape · webkit", use: { ...devices["iPad (gen 7) landscape"] } },
    { name: "macbook-1440 · webkit", use: { browserName: "webkit", ...desktop(1440, 900) } },
    { name: "macbook-1440 · chromium", use: { browserName: "chromium", ...desktop(1440, 900) } },
    { name: "windows-1366 · chromium", use: { browserName: "chromium", ...desktop(1366, 768) } },
    { name: "windows-1366 · firefox", use: { browserName: "firefox", ...desktop(1366, 768) } },
    { name: "desktop-1920 · chromium", use: { browserName: "chromium", ...desktop(1920, 1080) } },
    { name: "desktop-1920 · firefox", use: { browserName: "firefox", ...desktop(1920, 1080) } },
  ],
});
