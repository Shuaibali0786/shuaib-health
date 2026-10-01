// Helper for replacing the placeholder photos with real ones.
//
//   npm run images -- check
//       Lists every expected image: real photo or placeholder, size, shape, weight.
//
//   npm run images -- fit "C:\path\to\photo.jpg" hero-doctor
//       Crops and resizes your photo to the exact size and shape the page expects
//       and writes it over the placeholder. Options:
//         --focus 0.5,0.3      the point to keep centred, as fractions of the photo
//                              (x across, y down): 0.5,0.3 = middle, 30% from the top.
//                              Use it so faces are never cut.
//         --position attention|centre|top|bottom|left|right   simpler alternative
//                              (default: attention). --focus wins if both are given.
//
// Keys are the file names without ".jpg": hero-doctor, clinic-interior,
// general-medicine, cardiology, dr-imran-qureshi, staying-hydrated, and so on.

import { existsSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { mkdirSync } from "node:fs";
import sharp from "sharp";
import { PLACEHOLDER_MARKER, images, imagesRoot } from "./image-list.mjs";

const MAX_KB = 400;
const RATIO_TOLERANCE = 0.02;
const [command, ...rest] = process.argv.slice(2);

const kb = (bytes) => Math.round(bytes / 1024);

async function describe(image) {
  const file = join(imagesRoot, image.path);
  if (!existsSync(file)) return { image, problems: ["MISSING FILE"], kind: "missing" };
  const meta = await sharp(file).metadata();
  const size = statSync(file).size;
  const isPlaceholder = Boolean(meta.exif && meta.exif.toString("latin1").includes(PLACEHOLDER_MARKER));
  const problems = [];
  const ratioOff = Math.abs(meta.width / meta.height - image.width / image.height) / (image.width / image.height);
  if (ratioOff > RATIO_TOLERANCE) problems.push(`wrong shape ${meta.width}x${meta.height}`);
  if (!isPlaceholder && meta.width < image.width) problems.push(`small (${meta.width}px wide, want ${image.width})`);
  if (!isPlaceholder && size > MAX_KB * 1024) problems.push(`heavy (${kb(size)} KB, want under ${MAX_KB})`);
  return { image, meta, size, problems, kind: isPlaceholder ? "placeholder" : "REAL" };
}

async function check() {
  let real = 0;
  let placeholders = 0;
  let bad = 0;
  console.log("status       key                       size        weight   notes");
  for (const image of images) {
    const result = await describe(image);
    if (result.kind === "REAL") real += 1;
    if (result.kind === "placeholder") placeholders += 1;
    if (result.problems.length) bad += 1;
    const dims = result.meta ? `${result.meta.width}x${result.meta.height}` : "-";
    const weight = result.size ? `${kb(result.size)} KB` : "-";
    console.log(
      `${result.kind.padEnd(12)} ${image.key.padEnd(25)} ${dims.padEnd(11)} ${weight.padEnd(8)} ${result.problems.join("; ") || "ok"}`,
    );
  }
  console.log(`\n${real} real, ${placeholders} placeholder, ${bad} with problems (of ${images.length}).`);
  if (bad > 0) process.exitCode = 1;
}

async function fit() {
  const positional = rest.filter((arg, i) => !arg.startsWith("--") && !rest[i - 1]?.startsWith("--"));
  const [source, key] = positional;
  const positionIndex = rest.indexOf("--position");
  const position = positionIndex >= 0 ? rest[positionIndex + 1] : "attention";
  const focusIndex = rest.indexOf("--focus");
  let focus = null;
  if (focusIndex >= 0) {
    const [fx, fy] = String(rest[focusIndex + 1]).split(",").map(Number);
    if (![fx, fy].every((n) => Number.isFinite(n) && n >= 0 && n <= 1)) {
      console.error('--focus needs two numbers between 0 and 1, for example --focus 0.5,0.3');
      process.exitCode = 1;
      return;
    }
    focus = { x: fx, y: fy };
  }

  if (!source || !key) {
    console.error('Usage: npm run images -- fit "C:\\path\\to\\photo.jpg" <key> [--focus 0.5,0.3 | --position attention|centre|top]');
    console.error("Keys: " + images.map((image) => image.key).join(", "));
    process.exitCode = 1;
    return;
  }
  const target = images.find((image) => image.key === key);
  if (!target) {
    console.error(`Unknown key "${key}". Keys: ${images.map((image) => image.key).join(", ")}`);
    process.exitCode = 1;
    return;
  }
  const sourceFile = resolve(source);
  if (!existsSync(sourceFile)) {
    console.error(`File not found: ${sourceFile}`);
    process.exitCode = 1;
    return;
  }

  const input = await sharp(sourceFile).metadata();
  const output = join(imagesRoot, target.path);
  mkdirSync(dirname(output), { recursive: true });
  let pipeline = sharp(sourceFile).rotate(); // respect the camera orientation
  let how = `${position} crop`;
  if (focus) {
    // Scale so the photo just covers the target, then cut a window centred on the focus point.
    const turned = input.orientation && input.orientation >= 5;
    const sourceWidth = turned ? input.height : input.width;
    const sourceHeight = turned ? input.width : input.height;
    const scale = Math.max(target.width / sourceWidth, target.height / sourceHeight);
    const scaledWidth = Math.max(target.width, Math.round(sourceWidth * scale));
    const scaledHeight = Math.max(target.height, Math.round(sourceHeight * scale));
    const clamp = (value, max) => Math.min(Math.max(value, 0), max);
    const left = clamp(Math.round(focus.x * scaledWidth - target.width / 2), scaledWidth - target.width);
    const top = clamp(Math.round(focus.y * scaledHeight - target.height / 2), scaledHeight - target.height);
    pipeline = pipeline
      .resize(scaledWidth, scaledHeight, { fit: "fill" })
      .extract({ left, top, width: target.width, height: target.height });
    const pct = (value) => Math.round(value * 100);
    how =
      `focus ${focus.x},${focus.y}; keeps x ${pct(left / scaledWidth)}-${pct((left + target.width) / scaledWidth)}%` +
      `, y ${pct(top / scaledHeight)}-${pct((top + target.height) / scaledHeight)}% of the photo`;
  } else {
    pipeline = pipeline.resize(target.width, target.height, { fit: "cover", position });
  }
  await pipeline.jpeg({ quality: 82, mozjpeg: true }).toFile(output);

  console.log(`Wrote public/images/${target.path}`);
  console.log(`  source ${input.width}x${input.height} -> ${target.width}x${target.height} (${how}), ${kb(statSync(output).size)} KB`);
  if (input.width < target.width || input.height < target.height) {
    console.log(`  WARNING: the source is smaller than ${target.width}x${target.height}, so it was enlarged and may look soft. A bigger original is better.`);
  }
  console.log("Next: update the alt text for this image in frontend\\src\\data (remove \"placeholder image\").");
}

if (command === "check") await check();
else if (command === "fit") await fit();
else {
  console.error("Usage: npm run images -- check | fit <file> <key>");
  process.exitCode = 1;
}
