// The images the site expects (specs/001-brand-home-page/image-manifest.md).
// Shared by generate-placeholder-images.mjs and images.mjs.

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const imagesRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "images");

/** Written into the EXIF of generated placeholders so `images check` can tell them from real photos. */
export const PLACEHOLDER_MARKER = "shuaib-health-placeholder";

const departments = ["general-medicine", "cardiology", "pediatrics", "gynecology", "dermatology", "dental", "pathology-lab"];
const doctors = ["dr-ayesha-rahman", "dr-imran-qureshi", "dr-sana-farooqui", "dr-hassan-mirza"];
const tips = ["staying-hydrated", "healthy-sleep-habits", "balanced-plate", "daily-walk"];

/** `key` is the short name used by `npm run images -- fit <file> <key>`. */
export const images = [
  { key: "hero-doctor", path: "hero/hero-doctor-placeholder.jpg", width: 1200, height: 1500 },
  { key: "clinic-interior", path: "clinic/clinic-interior-placeholder.jpg", width: 1200, height: 900 },
  ...departments.map((slug) => ({ key: slug, path: `departments/${slug}-placeholder.jpg`, width: 800, height: 600 })),
  ...doctors.map((slug) => ({ key: slug, path: `doctors/${slug}-placeholder.jpg`, width: 600, height: 750 })),
  ...tips.map((slug) => ({ key: slug, path: `tips/${slug}-placeholder.jpg`, width: 800, height: 500 })),
];
