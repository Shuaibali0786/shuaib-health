// Writes public/images/brand/logo-mark.svg from the same shapes as the LogoMark component, so the
// file and the component cannot drift (tests/unit/logo-mark.test.ts checks they match).
//
//   npm run logo:svg
//
// A standalone file cannot read the site's CSS variables, so the colours come from brand-marks.ts
// (the Booking Plus mark, default drawing, light colours).
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { MARK_COLOURS, MARK_LARGE, MARK_VIEWBOX } from "../src/lib/brand-marks.ts";

export function buildLogoSvg() {
  const rects = MARK_LARGE.map(
    (r) => `  <rect x="${r.x}" y="${r.y}" width="${r.width}" height="${r.height}" rx="${r.rx}" fill="${MARK_COLOURS.light[r.part]}"/>`,
  ).join("\n");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${MARK_VIEWBOX} ${MARK_VIEWBOX}" width="${MARK_VIEWBOX}" height="${MARK_VIEWBOX}" role="img">
  <title>Logo mark</title>
${rects}
</svg>
`;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const target = fileURLToPath(new URL("../public/images/brand/logo-mark.svg", import.meta.url));
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, buildLogoSvg());
  console.log(`Wrote ${target}`);
}
