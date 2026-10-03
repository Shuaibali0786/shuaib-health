import { test as base } from "@playwright/test";

import { resetMode } from "../mock-api";

/** Mock API behind the warm stateful Next server (playwright.stateful.config.ts). */
export const API_BASE = "http://127.0.0.1:4011";

export const test = base.extend<{ resetApi: void }>({
  resetApi: [
    async ({}, use) => {
      await resetMode(API_BASE);
      await use();
    },
    { auto: true },
  ],
});

export { expect } from "@playwright/test";
