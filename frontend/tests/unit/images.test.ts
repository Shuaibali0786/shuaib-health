import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { departments } from "@/data/departments";
import { doctors } from "@/data/doctors";
import { healthTips } from "@/data/healthTips";
import { clinicImage, heroImage } from "@/data/homeContent";
import type { ImageAsset } from "@/types/content";

// npm run test always runs from frontend/.
const PUBLIC = join(process.cwd(), "public");
const IMAGES = join(PUBLIC, "images");

const referenced: Array<{ owner: string; image: ImageAsset }> = [
  { owner: "hero", image: heroImage },
  { owner: "clinic", image: clinicImage },
  ...departments.map((department) => ({ owner: `department ${department.slug}`, image: department.image })),
  ...doctors.map((doctor) => ({ owner: `doctor ${doctor.slug}`, image: doctor.photo })),
  ...healthTips.map((tip) => ({ owner: `tip ${tip.slug}`, image: tip.image })),
];

function filesUnder(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    return statSync(path).isDirectory() ? filesUnder(path) : [path];
  });
}

describe("images referenced by the data files", () => {
  it("covers all expected images (22 now; 24 once the two Feature 002 health-tip photos are used, task T071)", () => {
    expect(referenced).toHaveLength(22);
  });

  it.each(referenced.map((entry) => [entry.owner, entry.image] as const))("%s: file exists and matches its declared size", async (_owner, image) => {
    expect(image.src.startsWith("/images/")).toBe(true);
    const file = join(PUBLIC, image.src);
    expect(existsSync(file)).toBe(true);
    const meta = await sharp(file).metadata();
    expect({ width: meta.width, height: meta.height }).toEqual({ width: image.width, height: image.height });
  });

  it.each(referenced.map((entry) => [entry.owner, entry.image] as const))("%s: has a real description, a clean file name and a sensible weight", (_owner, image) => {
    expect(image.alt.trim().length).toBeGreaterThan(10);
    expect(image.alt.toLowerCase()).not.toContain("placeholder");
    expect(image.src.toLowerCase()).not.toContain("placeholder");
    expect(statSync(join(PUBLIC, image.src)).size).toBeLessThanOrEqual(400 * 1024);
  });

  it("has no image file that nothing references", () => {
    // Added in Feature 002 but not used by any record yet. Delete this list in task T071 (health tips).
    const PENDING = ["/images/tips/hand-hygiene.jpg", "/images/tips/managing-stress.jpg"];
    const used = new Set([...referenced.map((entry) => entry.image.src), ...PENDING].map((src) => join(PUBLIC, src)));
    const unused = filesUnder(IMAGES)
      .filter((file) => !used.has(file))
      .map((file) => file.replace(PUBLIC, ""));
    expect(unused).toEqual([]);
  });

  it("uses unique files", () => {
    const sources = referenced.map((entry) => entry.image.src);
    expect(new Set(sources).size).toBe(sources.length);
  });
});
