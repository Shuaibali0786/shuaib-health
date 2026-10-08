// Builds the three fonts the appointment-slip PDF embeds, from the website's own brand fonts:
// Inter Regular and SemiBold (body), Plus Jakarta Sans Bold (headings). Each is cut down to the Latin-1
// letters the slip can print (plus the dashes, quotes and bullet of Windows-1252), so the PDF stays small,
// and its glyph widths are written to src/lib/booking/slip-font-metrics.json for layout.
//
//   node scripts/subset-slip-fonts.mjs <Inter_400Regular.ttf> <Inter_600SemiBold.ttf> <PlusJakartaSans_700Bold.ttf>
//
// The sources are the static TrueType files of the Google Fonts families (SIL Open Font License 1.1).
// Run it only when a font changes; the output is committed.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const [regularPath, semiBoldPath, headingPath] = process.argv.slice(2);
if (!regularPath || !semiBoldPath || !headingPath) throw new Error("usage: subset-slip-fonts.mjs <regular.ttf> <semibold.ttf> <heading-bold.ttf>");

/** Windows-1252 bytes 0x80-0x9F that are not the same code point as in Latin-1. */
const CP1252 = { 0x80: 0x20ac, 0x82: 0x201a, 0x83: 0x0192, 0x84: 0x201e, 0x85: 0x2026, 0x86: 0x2020, 0x87: 0x2021, 0x88: 0x02c6, 0x89: 0x2030, 0x8a: 0x0160, 0x8b: 0x2039, 0x8c: 0x0152, 0x8e: 0x017d, 0x91: 0x2018, 0x92: 0x2019, 0x93: 0x201c, 0x94: 0x201d, 0x95: 0x2022, 0x96: 0x2013, 0x97: 0x2014, 0x98: 0x02dc, 0x99: 0x2122, 0x9a: 0x0161, 0x9b: 0x203a, 0x9c: 0x0153, 0x9e: 0x017e, 0x9f: 0x0178 };
const unicodeOf = (code) => CP1252[code] ?? code;

function parse(buffer) {
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  const tables = {};
  for (let i = 0; i < view.getUint16(4); i++) {
    const at = 12 + i * 16;
    const tag = String.fromCharCode(...buffer.subarray(at, at + 4));
    tables[tag] = buffer.subarray(view.getUint32(at + 8), view.getUint32(at + 8) + view.getUint32(at + 12));
  }
  return { view, tables };
}

const dv = (bytes) => new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

/** Glyph id for a code point, from the (3,1) or (3,10) cmap subtable. */
function cmapLookup(cmap) {
  const view = dv(cmap);
  let format4 = null;
  let format12 = null;
  for (let i = 0; i < view.getUint16(2); i++) {
    const platform = view.getUint16(4 + i * 8);
    const encoding = view.getUint16(6 + i * 8);
    const offset = view.getUint32(8 + i * 8);
    if (platform === 3 && encoding === 1) format4 = offset;
    if (platform === 3 && encoding === 10) format12 = offset;
  }
  return (cp) => {
    if (format12 !== null) {
      for (let g = 0; g < view.getUint32(format12 + 12); g++) {
        const at = format12 + 16 + g * 12;
        if (cp >= view.getUint32(at) && cp <= view.getUint32(at + 4)) return view.getUint32(at + 8) + (cp - view.getUint32(at));
      }
    }
    if (format4 === null) return 0;
    const segCount = view.getUint16(format4 + 6) / 2;
    const ends = format4 + 14;
    const starts = ends + segCount * 2 + 2;
    const deltas = starts + segCount * 2;
    const ranges = deltas + segCount * 2;
    for (let s = 0; s < segCount; s++) {
      if (cp > view.getUint16(ends + s * 2) || cp < view.getUint16(starts + s * 2)) continue;
      const rangeOffset = view.getUint16(ranges + s * 2);
      if (rangeOffset === 0) return (cp + view.getInt16(deltas + s * 2)) & 0xffff;
      const g = view.getUint16(ranges + s * 2 + rangeOffset + (cp - view.getUint16(starts + s * 2)) * 2);
      return g === 0 ? 0 : (g + view.getInt16(deltas + s * 2)) & 0xffff;
    }
    return 0;
  };
}

function checksum(bytes) {
  const padded = new Uint8Array(Math.ceil(bytes.length / 4) * 4);
  padded.set(bytes);
  const view = dv(padded);
  let sum = 0;
  for (let i = 0; i < padded.length; i += 4) sum = (sum + view.getUint32(i)) >>> 0;
  return sum;
}

function assemble(tables) {
  const tags = Object.keys(tables).sort();
  const headerSize = 12 + tags.length * 16;
  let size = headerSize;
  for (const tag of tags) size += Math.ceil(tables[tag].length / 4) * 4;
  const out = new Uint8Array(size);
  const view = dv(out);
  const entrySelector = Math.floor(Math.log2(tags.length));
  view.setUint32(0, 0x00010000);
  view.setUint16(4, tags.length);
  view.setUint16(6, 2 ** entrySelector * 16);
  view.setUint16(8, entrySelector);
  view.setUint16(10, tags.length * 16 - 2 ** entrySelector * 16);
  let offset = headerSize;
  tags.forEach((tag, i) => {
    const at = 12 + i * 16;
    out.set(new TextEncoder().encode(tag), at);
    view.setUint32(at + 4, checksum(tables[tag]));
    view.setUint32(at + 8, offset);
    view.setUint32(at + 12, tables[tag].length);
    out.set(tables[tag], offset);
    offset += Math.ceil(tables[tag].length / 4) * 4;
  });
  view.setUint32(dv(out).getUint32(12 + tags.indexOf("head") * 16 + 8) + 8, (0xb1b0afba - checksum(out)) >>> 0);
  return out;
}

function subset(path, postScriptName) {
  const { tables } = parse(new Uint8Array(readFileSync(path)));
  const head = dv(tables.head);
  const maxp = dv(tables.maxp);
  const hhea = dv(tables.hhea);
  const hmtx = dv(tables.hmtx);
  const unitsPerEm = head.getUint16(18);
  const longLoca = head.getInt16(50) === 1;
  const numGlyphs = maxp.getUint16(4);
  const loca = dv(tables.loca);
  const glyphStart = (g) => (longLoca ? loca.getUint32(g * 4) : loca.getUint16(g * 2) * 2);
  const lookup = cmapLookup(tables.cmap);
  const scale = (v) => Math.round((v * 1000) / unitsPerEm);

  const codes = [];
  for (let code = 32; code <= 255; code++) if (code !== 127 && !(code >= 0x81 && code <= 0x9f && !(code in CP1252))) codes.push(code);
  const gidOf = new Map(codes.map((code) => [code, lookup(unicodeOf(code))]));

  // Keep each glyph the slip can print, and any glyph a composite is built from.
  const keep = new Set([0]);
  const add = (g) => {
    if (keep.has(g) || g >= numGlyphs) return;
    keep.add(g);
    const start = glyphStart(g);
    if (glyphStart(g + 1) === start) return;
    const glyph = dv(tables.glyf.subarray(start));
    if (glyph.getInt16(0) >= 0) return;
    for (let at = 10, more = true; more; ) {
      const flags = glyph.getUint16(at);
      add(glyph.getUint16(at + 2));
      at += 4 + (flags & 1 ? 4 : 2) + (flags & 8 ? 2 : flags & 0x40 ? 4 : flags & 0x80 ? 8 : 0);
      more = (flags & 0x20) !== 0;
    }
  };
  for (const g of gidOf.values()) add(g);

  const pieces = [];
  const newLoca = new Uint8Array((numGlyphs + 1) * 4);
  const locaView = dv(newLoca);
  let length = 0;
  for (let g = 0; g < numGlyphs; g++) {
    locaView.setUint32(g * 4, length);
    if (!keep.has(g)) continue;
    const data = tables.glyf.subarray(glyphStart(g), glyphStart(g + 1));
    const padded = new Uint8Array(Math.ceil(data.length / 4) * 4);
    padded.set(data);
    pieces.push(padded);
    length += padded.length;
  }
  locaView.setUint32(numGlyphs * 4, length);
  const glyf = new Uint8Array(length);
  let at = 0;
  for (const piece of pieces) {
    glyf.set(piece, at);
    at += piece.length;
  }

  // A cmap with only the codes above, one segment each.
  const entries = [...gidOf].filter(([, g]) => g !== 0).sort((a, b) => unicodeOf(a[0]) - unicodeOf(b[0]));
  const segCount = entries.length + 1;
  const sub = new Uint8Array(16 + segCount * 8);
  const subView = dv(sub);
  subView.setUint16(0, 4);
  subView.setUint16(2, sub.length);
  subView.setUint16(6, segCount * 2);
  const ends = 14;
  const starts = ends + segCount * 2 + 2;
  const deltas = starts + segCount * 2;
  entries.forEach(([code, g], i) => {
    const cp = unicodeOf(code);
    subView.setUint16(ends + i * 2, cp);
    subView.setUint16(starts + i * 2, cp);
    subView.setUint16(deltas + i * 2, (g - cp) & 0xffff);
  });
  subView.setUint16(ends + entries.length * 2, 0xffff);
  subView.setUint16(starts + entries.length * 2, 0xffff);
  subView.setUint16(deltas + entries.length * 2, 1);
  const cmap = new Uint8Array(12 + sub.length);
  const cmapView = dv(cmap);
  cmapView.setUint16(2, 1);
  cmapView.setUint16(4, 3);
  cmapView.setUint16(6, 1);
  cmapView.setUint32(8, 12);
  cmap.set(sub, 12);

  const newHead = new Uint8Array(tables.head);
  dv(newHead).setInt16(50, 1);
  dv(newHead).setUint32(8, 0);
  const post = new Uint8Array(32);
  dv(post).setUint32(0, 0x00030000);
  const out = { cmap, glyf, head: newHead, hhea: tables.hhea, hmtx: tables.hmtx, loca: newLoca, maxp: tables.maxp, post };
  for (const tag of ["cvt ", "fpgm", "prep"]) if (tables[tag]) out[tag] = tables[tag];

  const os2 = tables["OS/2"] ? dv(tables["OS/2"]) : null;
  const capHeight = os2 && os2.getUint16(0) >= 2 ? os2.getInt16(88) : 0.7 * unitsPerEm;
  const widths = [];
  for (let code = 32; code <= 255; code++) {
    const g = gidOf.get(code) ?? 0;
    const advance = g < hhea.getUint16(34) ? hmtx.getUint16(g * 4) : hmtx.getUint16((hhea.getUint16(34) - 1) * 4);
    widths.push(scale(advance));
  }
  return {
    bytes: assemble(out),
    metrics: {
      name: postScriptName,
      unitsPerEm,
      ascent: scale(hhea.getInt16(4)),
      descent: scale(hhea.getInt16(6)),
      capHeight: scale(capHeight),
      bbox: [scale(head.getInt16(36)), scale(head.getInt16(38)), scale(head.getInt16(40)), scale(head.getInt16(42))],
      firstChar: 32,
      widths,
    },
  };
}

const outDir = join(root, "public", "fonts", "slip");
mkdirSync(outDir, { recursive: true });
const built = { F1: subset(regularPath, "Inter-Regular"), F2: subset(semiBoldPath, "Inter-SemiBold"), F3: subset(headingPath, "PlusJakartaSans-Bold") };
const files = { F1: "inter-regular.ttf", F2: "inter-semibold.ttf", F3: "plus-jakarta-sans-bold.ttf" };
const metrics = {};
for (const key of Object.keys(built)) {
  writeFileSync(join(outDir, files[key]), built[key].bytes);
  metrics[key] = { file: files[key], ...built[key].metrics };
  console.log(`${files[key]}: ${built[key].bytes.length} bytes`);
}
writeFileSync(join(root, "src", "lib", "booking", "slip-font-metrics.json"), `${JSON.stringify(metrics)}\n`);
