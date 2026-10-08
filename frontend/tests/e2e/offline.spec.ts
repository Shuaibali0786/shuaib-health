import { expect, test } from "@playwright/test";

test.describe("offline behaviour: nothing needs another site", () => {
  test.beforeEach(async ({ page, baseURL }) => {
    const origin = new URL(baseURL ?? "http://localhost:3100").origin;
    // Block every request that is not to the site itself, as a visitor with no outside network would see.
    await page.route("**/*", (route) => {
      const url = route.request().url();
      if (url.startsWith("data:") || url.startsWith("blob:") || new URL(url).origin === origin) return route.continue();
      return route.abort();
    });
  });

  test("search, FAQ and the contact form work with zero external requests", async ({ page, baseURL }) => {
    const external: string[] = [];
    const origin = new URL(baseURL ?? "http://localhost:3100").origin;
    page.on("request", (request) => {
      const url = request.url();
      if (!url.startsWith("data:") && !url.startsWith("blob:") && new URL(url).origin !== origin) external.push(url);
    });

    await page.goto("/lab-tests");
    await page.locator("[data-filters-ready]").waitFor(); // typed before hydration, the filter would miss it
    await page.getByLabel("Search tests").fill("HbA1c");
    await expect(page.getByRole("article").first()).toContainText("HbA1c");

    await page.goto("/faq");
    const first = page.locator("details").first();
    await first.locator("summary").click();
    await expect(first).toHaveAttribute("open", "");

    await page.goto("/contact");
    await page.getByLabel(/Your name/).fill("Ayesha Khan");
    await page.getByLabel(/Phone or email/).fill("+92 300 0000000");
    await page.getByLabel(/Subject/).fill("Opening hours");
    await page.getByLabel(/Message/).fill("Are you open on Saturday evening?");
    await page.getByRole("button", { name: "Send message" }).click();
    await expect(page.getByRole("status")).toContainText("Nothing was saved or transmitted.");

    expect(external).toEqual([]);
  });

  test("when the map frame is blocked the text address stays readable", async ({ page }) => {
    await page.goto("/contact");
    await expect(page.getByRole("main").locator("address")).toBeVisible();
    await page.getByRole("button", { name: "Show map" }).click();
    await expect(page.getByRole("main").locator("address")).toBeVisible();
    await expect(page.getByRole("link", { name: /Open this area in OpenStreetMap/ })).toBeVisible();
  });
});
