// Generates the labelled placeholder photos listed in
// specs/001-brand-home-page/image-manifest.md.
//
// Run from frontend\:   npm run images:placeholders
// Overwrite existing:   npm run images:placeholders -- --force
//
// Existing files are skipped by default, so real photos that replaced a
// placeholder are never overwritten by accident.

import { existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const force = process.argv.includes("--force");
const imagesRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "images");

const departments = ["general-medicine", "cardiology", "pediatrics", "gynecology", "dermatology", "dental", "pathology-lab"];
const doctors = ["dr-ayesha-rahman", "dr-imran-qureshi", "dr-sana-farooqui", "dr-hassan-mirza"];
const tips = ["staying-hydrated", "healthy-sleep-habits", "balanced-plate", "daily-walk"];

const images = [
  { path: "hero/hero-doctor-placeholder.jpg", width: 1200, height: 1500 },
  { path: "clinic/clinic-interior-placeholder.jpg", width: 1200, height: 900 },
  ...departments.map((slug) => ({ path: `departments/${slug}-placeholder.jpg`, width: 800, height: 600 })),
  ...doctors.map((slug) => ({ path: `doctors/${slug}-placeholder.jpg`, width: 600, height: 750 })),
  ...tips.map((slug) => ({ path: `tips/${slug}-placeholder.jpg`, width: 800, height: 500 })),
];

function svgFor({ path, width, height }) {
  const fileName = path.split("/").pop();
  const base = Math.min(width, height);
  const titleSize = Math.round(base * 0.1);
  const nameSize = Math.round(Math.min(width * 0.038, base * 0.06));
  const sizeText = `${width} x ${height}`;
  const cx = width / 2;
  const cy = height / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#14B8A6"/>
      <stop offset="1" stop-color="#0B2545"/>
    </linearGradient>
  </defs>
  <rect width="${width}" height="${height}" fill="url(#g)"/>
  <rect x="${base * 0.04}" y="${base * 0.04}" width="${width - base * 0.08}" height="${height - base * 0.08}" rx="${base * 0.03}" fill="none" stroke="#ffffff" stroke-opacity="0.55" stroke-width="3" stroke-dasharray="14 10"/>
  <g font-family="Arial, Helvetica, sans-serif" fill="#ffffff" text-anchor="middle">
    <text x="${cx}" y="${cy - titleSize * 0.2}" font-size="${titleSize}" font-weight="700" letter-spacing="${titleSize * 0.06}">PLACEHOLDER</text>
    <text x="${cx}" y="${cy + nameSize * 1.4}" font-size="${nameSize}">${fileName}</text>
    <text x="${cx}" y="${cy + nameSize * 2.9}" font-size="${nameSize}" fill-opacity="0.8">${sizeText}</text>
  </g>
</svg>`;
}

let created = 0;
let skipped = 0;

for (const image of images) {
  const target = join(imagesRoot, image.path);
  if (existsSync(target) && !force) {
    skipped += 1;
    console.log(`skip    ${image.path} (exists)`);
    continue;
  }
  mkdirSync(dirname(target), { recursive: true });
  await sharp(Buffer.from(svgFor(image))).jpeg({ quality: 80, mozjpeg: true }).toFile(target);
  created += 1;
  console.log(`created ${image.path} (${image.width}x${image.height})`);
}

console.log(`\nDone: ${created} created, ${skipped} skipped, ${images.length} total.`);
