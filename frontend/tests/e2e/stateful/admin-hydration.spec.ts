import { expect, type BrowserContext, type Page } from "@playwright/test";

import { signIn } from "../admin-helpers";
import { setMode } from "../mock-api";
import { API_BASE, test } from "./fixtures";

// Regression for the live React error #418 (hydration mismatch) on /admin/bookings (Feature 012). With the bookings
// search slowed down, the page streams in after the shell and its bell have hydrated and polled, which is what a cold
// serverless start does live. The page must hydrate without any mismatch, and then show what the bell knows. (The count
// cards and the bell are covered by tests/unit/bell-hydration.test.tsx; the Overview does not wait for the search.)

function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  return errors;
}

/** `next dev` compiles each route on first use; load the page once so the bell's API route answers fast after. */
async function warmUp(page: Page, path: string): Promise<void> {
  await page.goto(path);
  await page.waitForLoadState("networkidle");
}

const hydrationErrors = (errors: string[]) => errors.filter((text) => /hydrat|#418|did(?:n't| not) match/i.test(text));

test.describe("a page that streams in after the bell has an answer", () => {
  test.beforeEach(async ({ context, baseURL }) => signIn(context as BrowserContext, "receptionist", baseURL!));

  for (const path of ["/admin/bookings", "/admin/bookings?view=upcoming"]) {
    test(`${path} hydrates without a mismatch on a slow first load`, async ({ page }) => {
      await warmUp(page, path);
      const errors = collectErrors(page);
      await setMode(API_BASE, "admin-search-slow");
      await page.goto(path);
      await expect(page.getByRole("heading", { name: "Bookings", level: 1 })).toBeVisible({ timeout: 20_000 });
      await page.waitForLoadState("networkidle");
      // The bell answered before the page hydrated; once hydrated, the page shows it.
      await expect(page.getByRole("button", { name: "Mark all seen" })).toBeVisible();
      expect(hydrationErrors(errors), errors.join("\n")).toEqual([]);
    });
  }

});
