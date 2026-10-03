import { departments } from "../../fixtures/catalog/departments";
import { doctors } from "../../fixtures/catalog/doctors";
import { requestLog, setMode } from "../mock-api";
import { API_BASE, expect, test } from "./fixtures";

const featured = doctors.find((doctor) => doctor.isFeatured)!;
const department = departments.find((candidate) => candidate.id === featured.departmentId)!;
const NEW_NAME = "Dr Renamed Test";

// US1 scenario 2: renaming a doctor in the catalog shows the new name on every page that lists the
// doctor, and none of them keeps the old name as a heading or link, within about 10 s (3 s data
// window plus a render). The mock changes `fullName` only, so the old name can legitimately remain
// in the free-text bio; names are therefore checked in headings and links, where `fullName` is shown.
test("a renamed doctor shows the new name everywhere within seconds", async ({ page }) => {
  const paths = ["/", "/doctors", `/doctors/${featured.slug}`, `/departments/${department.slug}`];
  const oldNameShown = () => page.locator(`h1, h2, h3, a`, { hasText: featured.fullName });

  for (const path of paths) {
    await page.goto(path);
    await expect(oldNameShown().first(), path).toBeVisible();
  }

  await setMode(API_BASE, "rename");
  await page.waitForTimeout(4000);

  for (const path of paths) {
    await expect
      .poll(
        async () => {
          await page.goto(path);
          return {
            path,
            newNameShown: (await page.locator("h1, h2, h3", { hasText: NEW_NAME }).count()) > 0,
            oldNameShown: await oldNameShown().count(),
          };
        },
        { message: path, timeout: 10_000 },
      )
      .toEqual({ path, newNameShown: true, oldNameShown: 0 });
  }

  const log = await requestLog(API_BASE);
  expect(log.doctors ?? 0, "doctors requests after the switch").toBeGreaterThanOrEqual(1);
});
