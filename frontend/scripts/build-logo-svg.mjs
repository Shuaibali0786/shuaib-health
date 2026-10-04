// Writes public/images/brand/logo-mark.svg from the same path data as the LogoMark component, so the
// file and the component cannot drift (tests/unit/logo-mark.test.ts checks they match).
//
//   npm run logo:svg
//
// A standalone file cannot read the site's CSS variables, so the two brand colours are written out
// here: navy-900 #0B2545 and teal-500 #14B8A6 (the same values LogoMark.tsx and lib/og.tsx use).
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { LOGO_VIEWBOX, PLUS_PATH, PULSE_PATH, PULSE_STROKE_WIDTH } from "../src/components/brand/logo-paths.ts";

const NAVY = "#0B2545";
const TEAL = "#14B8A6";

export function buildLogoSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${LOGO_VIEWBOX} ${LOGO_VIEWBOX}" width="${LOGO_VIEWBOX}" height="${LOGO_VIEWBOX}" role="img">
  <title>Logo mark</title>
  <defs>
    <linearGradient id="logo-gradient" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${TEAL}"/>
      <stop offset="1" stop-color="${NAVY}"/>
    </linearGradient>
  </defs>
  <path d="${PLUS_PATH}" fill="url(#logo-gradient)"/>
  <path d="${PULSE_PATH}" fill="none" stroke="#ffffff" stroke-width="${PULSE_STROKE_WIDTH}" stroke-linecap="round" stroke-linejoin="round"/>
</svg>
`;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const target = fileURLToPath(new URL("../public/images/brand/logo-mark.svg", import.meta.url));
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, buildLogoSvg());
  console.log(`Wrote ${target}`);
}
