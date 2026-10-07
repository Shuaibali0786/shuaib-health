import { expect, test, type Page } from "@playwright/test";

import { SESSION_COOKIE } from "./admin-helpers";

// The one-click demo (Feature 006, US1) against the mock API: entry from the public pages and the login
// page, the ribbon, the read-only server, and an ended demo. The mock serves the committed demo day
// (tests/fixtures/admin/demo-day.json), so every run sees the same clinic.

const DEMO_BUTTON = { name: "View Demo Dashboard" } as const;

async function expectDemoOverview(page: Page) {
  await expect(page).toHaveURL(/\/admin$/);
  const ribbon = page.getByTestId("demo-ribbon");
  await expect(ribbon).toBeVisible();
  await expect(ribbon).toContainText("Demo mode — changes are not saved.");
  await expect(ribbon).toContainText("All names and numbers are sample data.");
  await expect(ribbon.getByRole("link", { name: "Back to website" })).toHaveAttribute("href", "/");
  await expect(ribbon.getByRole("link", { name: "Staff sign-in" })).toHaveAttribute("href", "/admin/login");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
}

test.describe("entering the demo", () => {
  test("from the gold top bar", async ({ page }) => {
    await page.goto("/");
    await page.getByTestId("announcement-bar").getByRole("button").click();
    await expectDemoOverview(page);
  });

  test("from the About page", async ({ page }) => {
    await page.goto("/about");
    await page.getByRole("main").getByRole("button", DEMO_BUTTON).click();
    await expectDemoOverview(page);
  });

  test("from the sign-in page", async ({ page }) => {
    await page.goto("/admin/login");
    await page.getByRole("button", DEMO_BUTTON).click();
    await expectDemoOverview(page);
  });

  test("the demo cookie is private to the staff app", async ({ page, context }) => {
    await page.goto("/admin/login");
    await page.getByRole("button", DEMO_BUTTON).click();
    await expectDemoOverview(page);
    const cookie = (await context.cookies()).find((c) => c.name === SESSION_COOKIE);
    expect(cookie).toMatchObject({ httpOnly: true, secure: true, sameSite: "Strict", path: "/" });
    expect(cookie?.value).toMatch(/^cd_/);
    expect(await page.evaluate(() => document.cookie)).not.toContain(SESSION_COOKIE);
  });

  test("a visitor sent back from a busy demo sees a calm message, not an error", async ({ browser, baseURL }) => {
    const context = await browser.newContext({ baseURL, extraHTTPHeaders: { "x-forwarded-for": "198.51.100.99" } });
    const page = await context.newPage();
    await page.goto("/");
    await page.getByTestId("announcement-bar").getByRole("button").click();
    await expect(page).toHaveURL(/\/admin\/login\?demo=busy$/);
    await expect(page.getByRole("status")).toHaveText("The demo is busy — try again in a minute.");
    await context.close();
  });
});

test.describe("the public pages' demo control", () => {
  test("is a plain form, with no link into the staff app and no prefetch", async ({ page }) => {
    const adminRequests: string[] = [];
    page.on("request", (request) => {
      if (new URL(request.url()).pathname.startsWith("/admin")) adminRequests.push(request.url());
    });
    for (const path of ["/", "/about"]) {
      await page.goto(path);
      const forms = page.locator("form[data-demo-entry]");
      await expect(forms.first()).toHaveAttribute("action", "/admin/demo/start");
      await expect(forms.first()).toHaveAttribute("method", "post");
      await expect(page.getByTestId("announcement-bar").locator("form[data-demo-entry]")).toHaveCount(1);
      await expect(page.getByRole("contentinfo").locator("form[data-demo-entry]")).toHaveCount(0); // the footer has no demo button
      const hrefs = await page.locator("a[href]").evaluateAll((links) => links.map((a) => a.getAttribute("href") ?? ""));
      expect(hrefs.filter((href) => href.startsWith("/admin")), path).toEqual([]);
      for (const link of (await page.locator("a[href^='/']").all()).slice(0, 10)) await link.hover({ timeout: 1000 }).catch(() => {});
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      await page.waitForLoadState("networkidle");
    }
    expect(adminRequests).toEqual([]);
  });
});

test.describe("the demo is read-only on the server", () => {
  test("a crafted write from the demo session is refused with 403 demo_read_only", async ({ page }) => {
    await page.goto("/admin/login");
    await page.getByRole("button", DEMO_BUTTON).click();
    await expectDemoOverview(page);
    const answer = await page.evaluate(async () => {
      const res = await fetch("/api/admin/staff", {
        method: "POST",
        headers: { "content-type": "application/json", "x-csrf-token": "anything" },
        body: JSON.stringify({ email: "x@clinic.test", displayName: "X Y", role: "admin", temporaryPassword: "Aa1-Aa1-Aa1-Aa1" }),
      });
      return { status: res.status, body: await res.json() };
    });
    expect(answer.status).toBe(403);
    expect(answer.body.error.code).toBe("demo_read_only");
  });

  test("the demo sees only sample staff", async ({ page }) => {
    await page.goto("/admin/login");
    await page.getByRole("button", DEMO_BUTTON).click();
    await expectDemoOverview(page);
    const staff = await page.evaluate(async () => (await fetch("/api/admin/staff")).json());
    expect(staff.map((member: { displayName: string }) => member.displayName)).toEqual(["Ayesha Khan", "Bilal Raza", "Hina Siddiqui", "Omar Farooq", "Sana Malik"]);
  });
});

test.describe("an ended demo", () => {
  test("offers a fresh demo, which lands on a new demo Overview", async ({ page, context, baseURL }) => {
    const url = new URL(baseURL!);
    await context.addCookies([
      { name: SESSION_COOKIE, value: "cd_e2e-demo-expired", domain: url.hostname, path: "/", secure: true, httpOnly: true, sameSite: "Strict" },
    ]);
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin\/login/);
    await expect(page.getByText("Your demo has ended.")).toBeVisible();
    await page.getByRole("button", { name: "Start a fresh demo" }).click();
    await expectDemoOverview(page);
    const cookie = (await context.cookies()).find((c) => c.name === SESSION_COOKIE);
    expect(cookie?.value).toMatch(/^cd_e2e-issued-/);
  });
});
