import { expect, test, type Page } from "@playwright/test";
import { faqGroups } from "../../src/data/faq";
import { NOTICE } from "./helpers";

const DEMO_MESSAGE = "Messages are not sent in this demo yet. Nothing was saved or transmitted.";

async function fillValid(page: Page) {
  await page.getByLabel(/Your name/).fill("Ayesha Khan");
  await page.getByLabel(/Phone or email/).fill("+92 300 0000000");
  await page.getByLabel(/Subject/).fill("Opening hours");
  await page.getByLabel(/Message/).fill("Are you open on Saturday evening?");
}

test.describe("contact page", () => {
  test("shows the sample numbers, the hours table and the demo notices", async ({ page }) => {
    await page.goto("/contact");
    await expect(page.getByRole("heading", { level: 1, name: "Contact us" })).toBeVisible();
    await expect(page.getByRole("main").getByText("Sample details", { exact: true })).toBeVisible();
    await expect(page.getByRole("main").getByRole("link", { name: "+92 21 0000 0001" })).toHaveAttribute("href", "tel:+922100000001");
    await expect(page.getByRole("main").getByRole("link", { name: "+92 21 0000 0000" })).toHaveAttribute("href", "tel:+922100000000");
    await expect(page.getByText("General enquiries (sample number)")).toBeVisible();
    await expect(page.getByText("Emergency (sample number)")).toBeVisible();
    await expect(page.getByText(/do not connect to anyone.*local emergency\s+services/)).toBeVisible();

    const table = page.getByRole("table");
    await expect(table.getByRole("rowheader", { name: "Clinic" })).toBeVisible();
    await expect(table.getByRole("rowheader", { name: "Lab" })).toBeVisible();
    await expect(table).toContainText("Mon–Sat, 9 AM – 9 PM PKT");
    await expect(table).toContainText("Mon–Sat, 8 AM – 8 PM PKT");
    await expect(table).toContainText("Sample hours");

    await expect(page.getByText("Map shows the general area; the address is a sample.")).toBeVisible();
    await expect(page.getByText(NOTICE)).toHaveCount(2);
    const crumbs = page.getByRole("navigation", { name: "Breadcrumb" });
    await expect(crumbs.getByText("Contact")).toHaveAttribute("aria-current", "page");
  });

  test("an empty submit shows the summary and errors next to each field, and focus moves to the summary", async ({ page }) => {
    await page.goto("/contact");
    await page.getByRole("button", { name: "Send message" }).click();
    const summary = page.getByRole("alert", { name: /problems? with your message/ }).filter({ hasText: "problems with your message" });
    await expect(summary).toContainText("There are 4 problems with your message");
    await expect(summary).toBeFocused();
    await expect(page.locator("#name-error")).toContainText("Enter your name.");
    await expect(page.locator("#message-error")).toContainText("Enter your message.");
    await expect(page.getByLabel(/Your name/)).toHaveAttribute("aria-invalid", "true");
    await expect(page.getByText(DEMO_MESSAGE)).toHaveCount(0);

    await summary.getByRole("link", { name: "Enter your name." }).click();
    await expect(page.getByLabel(/Your name/)).toBeFocused();
  });

  test("an invalid submit keeps the typed text, and then a valid submit shows the demo message", async ({ page }) => {
    await page.goto("/contact");
    await page.getByLabel(/Your name/).fill("Ayesha Khan");
    await page.getByLabel(/Phone or email/).fill("hello");
    await page.getByLabel(/Subject/).fill("Opening hours");
    await page.getByLabel(/Message/).fill("short");
    await page.getByRole("button", { name: "Send message" }).click();
    await expect(page.getByRole("alert", { name: /problems? with your message/ })).toContainText("There are 2 problems with your message");
    await expect(page.getByLabel(/Your name/)).toHaveValue("Ayesha Khan");
    await expect(page.getByLabel(/Message/)).toHaveValue("short");
    await expect(page.locator("#contact-error")).toContainText("valid phone number");

    await fillValid(page);
    await page.getByRole("button", { name: "Send message" }).click();
    await expect(page.getByRole("status").filter({ hasText: DEMO_MESSAGE })).toBeVisible();
    await expect(page.getByRole("alert", { name: /problems? with your message/ })).toHaveCount(0);
    await expect(page.getByLabel(/Your name/)).toHaveValue("");
  });

  test("accepts an email instead of a phone number", async ({ page }) => {
    await page.goto("/contact");
    await fillValid(page);
    await page.getByLabel(/Phone or email/).fill("ayesha@example.com");
    await page.getByRole("button", { name: "Send message" }).click();
    await expect(page.getByText(DEMO_MESSAGE)).toBeVisible();
  });

  test("the form can be completed and submitted with the keyboard alone", async ({ page, isMobile }) => {
    test.skip(isMobile, "needs a physical keyboard; covered on the desktop project");
    await page.goto("/contact");
    await page.getByLabel(/Your name/).focus();
    await page.keyboard.type("Ayesha Khan");
    await page.keyboard.press("Tab");
    await page.keyboard.type("0300-0000000");
    await page.keyboard.press("Tab");
    await page.keyboard.type("Opening hours");
    await page.keyboard.press("Tab");
    await page.keyboard.type("Are you open on Saturday evening?");
    await page.keyboard.press("Tab");
    await expect(page.getByRole("button", { name: "Send message" })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.getByText(DEMO_MESSAGE)).toBeVisible();
  });

  test("submitting makes no request at all, to this site or any other", async ({ page, baseURL }) => {
    const origin = new URL(baseURL ?? "http://localhost:3100").origin;
    const outside: string[] = [];
    await page.route((url) => url.origin !== origin && !url.protocol.startsWith("data"), (route) => {
      outside.push(route.request().url());
      return route.abort();
    });
    await page.goto("/contact");
    await page.waitForLoadState("networkidle");

    // Next's own link prefetches (?_rsc=) and script chunks (/_next/) can fire as the page scrolls; they
    // are not the form. Anything else, and any request that is not a GET, counts as the form sending.
    const requests: string[] = [];
    page.on("request", (request) => {
      const url = request.url();
      if (url.includes("_rsc=") || new URL(url).pathname.startsWith("/_next/")) {
        expect(request.method()).toBe("GET");
        return;
      }
      requests.push(`${request.method()} ${url}`);
    });
    await page.getByRole("button", { name: "Send message" }).click();
    await expect(page.getByRole("alert", { name: /problems? with your message/ })).toBeVisible();
    await fillValid(page);
    await page.getByRole("button", { name: "Send message" }).click();
    await expect(page.getByText(DEMO_MESSAGE)).toBeVisible();
    await page.waitForTimeout(500);
    expect(requests).toEqual([]);
    expect(outside).toEqual([]);
    expect(await page.evaluate(() => window.localStorage.length + window.sessionStorage.length)).toBe(0);
  });

  test("loads no outside map until Show map is pressed, and then only OpenStreetMap", async ({ page }) => {
    const outside: string[] = [];
    await page.route(/openstreetmap\.org/, (route) => {
      outside.push(route.request().url());
      return route.fulfill({ status: 200, contentType: "text/html", body: "<p>map</p>" });
    });
    await page.goto("/contact");
    await page.waitForLoadState("networkidle");
    expect(outside).toEqual([]);
    await expect(page.locator("iframe")).toHaveCount(0);
    await expect(page.getByText("Showing the map contacts OpenStreetMap.")).toBeVisible();
    await expect(page.getByRole("link", { name: /Open this area in OpenStreetMap/ })).toBeVisible();

    await page.getByRole("button", { name: "Show map" }).click();
    const frame = page.locator("iframe[title='Map: General area of Karachi']");
    await expect(frame).toHaveCount(1);
    await expect(frame).toHaveAttribute("sandbox", "allow-scripts allow-same-origin");
    await expect(frame).toHaveAttribute("referrerpolicy", "no-referrer");
    await expect.poll(() => outside.length).toBeGreaterThan(0);
    for (const url of outside) expect(new URL(url).origin).toBe("https://www.openstreetmap.org");
    await expect(page.getByText("Map shows the general area; the address is a sample.")).toBeVisible();
  });

  test("works without JavaScript: details, hours and the map's text fallback are all there", async ({ browser, baseURL }) => {
    const context = await browser.newContext({ javaScriptEnabled: false, baseURL });
    const page = await context.newPage();
    await page.goto("/contact");
    await expect(page.getByRole("table")).toBeVisible();
    await expect(page.getByText("Map shows the general area; the address is a sample.")).toBeVisible();
    await context.close();
  });
});

test.describe("faq page", () => {
  test("shows the five groups with at least three questions each, and links to each group", async ({ page }) => {
    await page.goto("/faq");
    await expect(page.getByRole("heading", { level: 1, name: "Frequently asked questions" })).toBeVisible();
    for (const group of faqGroups) {
      await expect(page.getByRole("heading", { level: 2, name: group.title, exact: true })).toBeVisible();
      await expect(page.locator(`section#${group.slug} details`)).toHaveCount(group.items.length);
      expect(group.items.length).toBeGreaterThanOrEqual(3);
      await expect(page.getByRole("navigation", { name: "FAQ groups" }).getByRole("link", { name: group.title, exact: true })).toHaveAttribute(
        "href",
        `#${group.slug}`,
      );
    }
    await expect(page.getByText(NOTICE)).toHaveCount(2);
  });

  for (const group of faqGroups) {
    test(`${group.title}: every question opens and closes with the keyboard`, async ({ page, isMobile }) => {
      test.skip(isMobile, "needs a physical keyboard; covered on the desktop project");
      await page.goto("/faq");
      const items = page.locator(`section#${group.slug} details`);
      for (let index = 0; index < group.items.length; index++) {
        const item = items.nth(index);
        const summary = item.locator("summary");
        await summary.focus();
        await expect(item).not.toHaveAttribute("open", /.*/);
        await page.keyboard.press("Enter");
        await expect(item).toHaveAttribute("open", "");
        await expect(item.getByText(group.items[index]!.answer)).toBeVisible();
        await page.keyboard.press("Space");
        await expect(item).not.toHaveAttribute("open", /.*/);
      }
    });
  }

  test("a question opens and closes with a click or tap", async ({ page }) => {
    await page.goto("/faq");
    const first = page.locator("section#appointments details").first();
    await first.locator("summary").click();
    await expect(first).toHaveAttribute("open", "");
    await first.locator("summary").click();
    await expect(first).not.toHaveAttribute("open", /.*/);
  });

  test("/faq#home-sample-collection scrolls to that group", async ({ page }) => {
    await page.goto("/faq#home-sample-collection");
    const heading = page.getByRole("heading", { level: 2, name: "Home sample collection" });
    await expect(heading).toBeInViewport();
    expect(new URL(page.url()).hash).toBe("#home-sample-collection");
  });

  test("Home's Home Sample Collection quick action leads to that group", async ({ page }) => {
    await page.goto("/");
    await page.locator("section[aria-labelledby='quick-actions-title']").getByRole("link", { name: /Home Sample Collection/ }).click();
    await expect(page).toHaveURL(/\/faq#home-sample-collection$/);
    await expect(page.getByRole("heading", { level: 2, name: "Home sample collection" })).toBeInViewport();
  });

  test("the answers work without JavaScript", async ({ browser, baseURL }) => {
    const context = await browser.newContext({ javaScriptEnabled: false, baseURL });
    const page = await context.newPage();
    await page.goto("/faq");
    const first = page.locator("section#payments details").first();
    await first.locator("summary").click();
    await expect(first).toHaveAttribute("open", "");
    await context.close();
  });
});
