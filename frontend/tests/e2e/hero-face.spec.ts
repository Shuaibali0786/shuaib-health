// Home hero first impression (owner test 2026-11-09): the doctor's face is fully visible at every width, and the three
// fact cards sit on the photo's edges ("Open" top-left, "Lab reports online" bottom-left, "Home sample collection"
// bottom-right), clear of the face and of the fixed "Ask us" button.
// Screenshots for review: HERO_SHOTS_DIR=<folder> npx playwright test hero-face --project=desktop --workers=1
import { expect, test, type Locator } from "@playwright/test";

type Box = { x: number; y: number; width: number; height: number };

// The doctor's head in /images/hero/hero-doctor.jpg (1200 x 1500), as fractions of the whole image, with a margin:
// the top of the hair, then the bun, face and chin.
const FACE = [
  { left: 0.44, right: 0.8, top: 0.06, bottom: 0.17 },
  { left: 0.37, right: 0.81, top: 0.15, bottom: 0.47 },
];

const WIDTHS = [
  { width: 1920, height: 1080 },
  { width: 1366, height: 768 },
  { width: 768, height: 1024 },
  { width: 390, height: 844 },
];

const overlaps = (a: Box, b: Box) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
const boxOf = async (l: Locator) => (await l.boundingBox()) as Box;

test.describe("hero: the doctor's face is never covered", () => {
  test.use({ reducedMotion: "reduce" });

  for (const size of WIDTHS) {
    test(`${size.width}px`, async ({ page }, info) => {
      test.skip(info.project.name !== "desktop", "one browser is enough: the widths are set here");
      await page.setViewportSize(size);
      await page.goto("/");
      const hero = page.locator("section[aria-labelledby='hero-title']");
      const photo = hero.locator("img").first();
      await expect(photo).toBeVisible();
      await photo.evaluate((img: HTMLImageElement) => (img.complete ? null : new Promise((r) => img.addEventListener("load", r, { once: true }))));

      // The "Ask us" button appears after hydration (when the assistant is on).
      await page.locator(".assistant-dock").waitFor({ timeout: 5000 }).catch(() => undefined);
      const dir = process.env.HERO_SHOTS_DIR;
      if (dir) {
        await page.screenshot({ path: `${dir}/hero-${size.width}-first-screen.png` });
        await hero.screenshot({ path: `${dir}/hero-${size.width}-section.png` });
      }

      const p = await boxOf(photo);
      // Where the image's pixels land in the box (on desktop the photo is cropped from the bottom with object-fit: cover).
      const fit = await photo.evaluate((img: HTMLImageElement) => {
        const style = getComputedStyle(img);
        const [px, py] = style.objectPosition.split(" ").map((v) => parseFloat(v) / 100);
        return { natW: img.naturalWidth, natH: img.naturalHeight, cover: style.objectFit === "cover", px: px ?? 0.5, py: py ?? 0.5 };
      });
      const scale = fit.cover ? Math.max(p.width / fit.natW, p.height / fit.natH) : p.width / fit.natW;
      const offX = (p.width - fit.natW * scale) * fit.px;
      const offY = fit.cover ? (p.height - fit.natH * scale) * fit.py : 0;
      const faces: Box[] = FACE.map((f) => ({
        x: p.x + offX + fit.natW * scale * f.left,
        y: p.y + offY + fit.natH * scale * f.top,
        width: fit.natW * scale * (f.right - f.left),
        height: fit.natH * scale * (f.bottom - f.top),
      }));
      // The whole head is inside the photo (not cropped away).
      for (const f of faces) expect(f.y >= p.y && f.y + f.height <= p.y + p.height, "the head is inside the photo").toBe(true);
      const cards = hero.locator("li");
      await expect(cards).toHaveCount(3);
      const dock = page.locator(".assistant-dock");
      const ask = (await dock.count()) ? await boxOf(dock) : null;

      const [open, reports, home] = await Promise.all([0, 1, 2].map((i) => boxOf(cards.nth(i))));
      for (const [name, card] of [["Open", open], ["Lab reports online", reports], ["Home sample collection", home]] as const) {
        for (const face of faces) expect(overlaps(card as Box, face), `${name} covers the face at ${size.width}px`).toBe(false);
        if (ask) expect(overlaps(card as Box, ask), `${name} is under the Ask us button at ${size.width}px: ${JSON.stringify({ card, ask })}`).toBe(false);
      }
      // Where each card sits on the photo.
      const mid = (b: Box) => ({ x: b.x + b.width / 2, y: b.y + b.height / 2 });
      expect(mid(open as Box).y, "Open: top edge").toBeLessThan(p.y + p.height * 0.25);
      expect(mid(open as Box).x, "Open: left").toBeLessThan(p.x + p.width / 2);
      // Owner 2026-11-09 (final polish): fully inside the photo's top-left corner.
      expect((open as Box).x, "Open: inside the photo (left)").toBeGreaterThanOrEqual(p.x);
      expect((open as Box).y, "Open: inside the photo (top)").toBeGreaterThanOrEqual(p.y);
      // Owner 2026-11-09: inside the photo, lower-left, about a third up from the bottom (not on the bottom edge).
      expect(mid(reports as Box).y, "Lab reports: lower part").toBeGreaterThan(p.y + p.height * 0.5);
      expect(mid(reports as Box).y, "Lab reports: a third up, not the bottom edge").toBeLessThan(p.y + p.height * 0.8);
      expect(mid(reports as Box).x, "Lab reports: left").toBeLessThan(p.x + p.width / 2);
      expect((reports as Box).x, "Lab reports: inside the photo").toBeGreaterThanOrEqual(p.x);
      // The cards never sit on each other.
      expect(overlaps(reports as Box, home as Box), "Lab reports and Home sample overlap").toBe(false);
      expect(overlaps(reports as Box, open as Box), "Lab reports and Open overlap").toBe(false);
      expect(mid(home as Box).y, "Home sample: bottom edge").toBeGreaterThan(p.y + p.height * 0.6);
      expect(mid(home as Box).x, "Home sample: right").toBeGreaterThan(p.x + p.width / 2);
      // Scrolled so the whole photo just fits (its bottom at the screen's bottom): still nothing under "Ask us".
      if (ask && p.y + p.height > size.height) {
        // Instant (the site scrolls smoothly), and again after the header settles, until the photo's bottom is 8 px
        // above the screen's bottom.
        for (let step = 0; step < 3; step++) {
          await photo.evaluate((img) => {
            const gap = img.getBoundingClientRect().bottom - (window.innerHeight - 8);
            window.scrollBy({ top: gap, behavior: "instant" });
          });
          await page.waitForTimeout(150);
        }
        const photoNow = await boxOf(photo);
        expect(Math.abs(photoNow.y + photoNow.height - (size.height - 8))).toBeLessThan(3);
        const askNow = await boxOf(dock);
        for (let i = 0; i < 3; i++) {
          const card = await boxOf(cards.nth(i));
          expect(overlaps(card, askNow), `card ${i + 1} is under Ask us when scrolled at ${size.width}px: ${JSON.stringify({ card, askNow, photoNow })}`).toBe(false);
        }
        if (dir) await page.screenshot({ path: `${dir}/hero-${size.width}-scrolled.png` });
        await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
      }
      // No sideways scrolling on any width.
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    });
  }

  test("the cards float gently, and stay still with reduced motion", async ({ page }, info) => {
    test.skip(info.project.name !== "desktop", "desktop only");
    await page.goto("/");
    const card = page.locator("section[aria-labelledby='hero-title'] li").first();
    expect(await card.evaluate((el) => getComputedStyle(el).animationName)).toBe("none");
    await page.emulateMedia({ reducedMotion: "no-preference" });
    expect(await card.evaluate((el) => getComputedStyle(el).animationName)).toBe("hero-float");
  });
});
