// A small QR Code encoder (ISO/IEC 18004: byte mode, error correction level M, versions 1-10), written
// out so no library ships to phones. It only ever encodes the booking reference (FR-057a).
// The layout follows the algorithm described in the QR specification.

const MAX_VERSION = 10;
const ECC_PER_BLOCK = [0, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26]; // level M, by version
const BLOCKS = [0, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5]; // level M, by version

const sizeOf = (version: number): number => version * 4 + 17;

function rawModules(version: number): number {
  let result = (16 * version + 128) * version + 64;
  if (version >= 2) {
    const aligns = Math.floor(version / 7) + 2;
    result -= (25 * aligns - 10) * aligns - 55;
    if (version >= 7) result -= 36;
  }
  return result;
}

const dataCodewords = (version: number): number =>
  Math.floor(rawModules(version) / 8) - (ECC_PER_BLOCK[version] ?? 0) * (BLOCKS[version] ?? 0);

// --- Reed-Solomon over GF(256), polynomial 0x11D --------------------------------------------------

function gfMultiply(x: number, y: number): number {
  let z = 0;
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d);
    z ^= ((y >>> i) & 1) * x;
  }
  return z;
}

function reedSolomonDivisor(degree: number): number[] {
  const result = new Array<number>(degree).fill(0);
  result[degree - 1] = 1;
  let root = 1;
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < degree; j++) {
      result[j] = gfMultiply(result[j] ?? 0, root);
      if (j + 1 < degree) result[j] = (result[j] ?? 0) ^ (result[j + 1] ?? 0);
    }
    root = gfMultiply(root, 2);
  }
  return result;
}

function reedSolomonRemainder(data: number[], divisor: number[]): number[] {
  const result = new Array<number>(divisor.length).fill(0);
  for (const byte of data) {
    const factor = byte ^ (result.shift() ?? 0);
    result.push(0);
    divisor.forEach((coef, i) => {
      result[i] = (result[i] ?? 0) ^ gfMultiply(coef, factor);
    });
  }
  return result;
}

// --- Data ----------------------------------------------------------------------------------------

function toBytes(text: string): number[] {
  return Array.from(new TextEncoder().encode(text));
}

function buildCodewords(bytes: number[], version: number): number[] {
  const bits: number[] = [];
  const push = (value: number, length: number) => {
    for (let i = length - 1; i >= 0; i--) bits.push((value >>> i) & 1);
  };
  push(0b0100, 4); // byte mode
  push(bytes.length, version <= 9 ? 8 : 16);
  for (const byte of bytes) push(byte, 8);
  const capacityBits = dataCodewords(version) * 8;
  push(0, Math.min(4, capacityBits - bits.length));
  push(0, (8 - (bits.length % 8)) % 8);
  const data: number[] = [];
  for (let i = 0; i < bits.length; i += 8) data.push(parseInt(bits.slice(i, i + 8).join(""), 2));
  for (let pad = 0xec; data.length < dataCodewords(version); pad ^= 0xec ^ 0x11) data.push(pad);
  return data;
}

function addEccAndInterleave(data: number[], version: number): number[] {
  const blocks = BLOCKS[version] ?? 1;
  const eccLen = ECC_PER_BLOCK[version] ?? 0;
  const raw = Math.floor(rawModules(version) / 8);
  const shortBlocks = blocks - (raw % blocks);
  const shortLen = Math.floor(raw / blocks);
  const divisor = reedSolomonDivisor(eccLen);
  const out: number[][] = [];
  for (let i = 0, k = 0; i < blocks; i++) {
    const dat = data.slice(k, k + shortLen - eccLen + (i < shortBlocks ? 0 : 1));
    k += dat.length;
    const ecc = reedSolomonRemainder(dat, divisor);
    if (i < shortBlocks) dat.push(0); // placeholder so every block lines up; skipped below
    out.push([...dat, ...ecc]);
  }
  const result: number[] = [];
  for (let i = 0; i < (out[0]?.length ?? 0); i++) {
    out.forEach((block, j) => {
      if (i !== shortLen - eccLen || j >= shortBlocks) result.push(block[i] ?? 0);
    });
  }
  return result;
}

// --- Matrix --------------------------------------------------------------------------------------

const bit = (value: number, index: number): boolean => ((value >>> index) & 1) !== 0;

function alignmentPositions(version: number): number[] {
  if (version === 1) return [];
  const count = Math.floor(version / 7) + 2;
  const step = Math.ceil((version * 4 + 4) / (count * 2 - 2)) * 2;
  const result = [6];
  for (let pos = sizeOf(version) - 7; result.length < count; pos -= step) result.splice(1, 0, pos);
  return result;
}

class Grid {
  readonly modules: boolean[][];
  readonly fixed: boolean[][];
  constructor(readonly size: number) {
    this.modules = Array.from({ length: size }, () => new Array<boolean>(size).fill(false));
    this.fixed = Array.from({ length: size }, () => new Array<boolean>(size).fill(false));
  }
  set(x: number, y: number, dark: boolean, fixed = true): void {
    const row = this.modules[y];
    const lock = this.fixed[y];
    if (!row || !lock) return;
    row[x] = dark;
    if (fixed) lock[x] = true;
  }
}

function drawFunctionPatterns(grid: Grid, version: number): void {
  const { size } = grid;
  for (let i = 0; i < size; i++) {
    grid.set(6, i, i % 2 === 0);
    grid.set(i, 6, i % 2 === 0);
  }
  const finder = (cx: number, cy: number) => {
    for (let dy = -4; dy <= 4; dy++) {
      for (let dx = -4; dx <= 4; dx++) {
        const dist = Math.max(Math.abs(dx), Math.abs(dy));
        const x = cx + dx;
        const y = cy + dy;
        if (x >= 0 && x < size && y >= 0 && y < size) grid.set(x, y, dist !== 2 && dist !== 4);
      }
    }
  };
  finder(3, 3);
  finder(size - 4, 3);
  finder(3, size - 4);
  const positions = alignmentPositions(version);
  positions.forEach((cy, i) => {
    positions.forEach((cx, j) => {
      const onFinder = (i === 0 && j === 0) || (i === 0 && j === positions.length - 1) || (i === positions.length - 1 && j === 0);
      if (onFinder) return;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) grid.set(cx + dx, cy + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
    });
  });
  drawFormat(grid, 0); // reserves the format area; redrawn with the real mask later
  if (version >= 7) {
    let rem = version;
    for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
    const bits = (version << 12) | rem;
    for (let i = 0; i < 18; i++) {
      const a = size - 11 + (i % 3);
      const b = Math.floor(i / 3);
      grid.set(a, b, bit(bits, i));
      grid.set(b, a, bit(bits, i));
    }
  }
}

function drawFormat(grid: Grid, mask: number): void {
  const { size } = grid;
  const data = (0 << 3) | mask; // error correction level M is 0b00
  let rem = data;
  for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
  const bits = ((data << 10) | rem) ^ 0x5412;
  for (let i = 0; i <= 5; i++) grid.set(8, i, bit(bits, i));
  grid.set(8, 7, bit(bits, 6));
  grid.set(8, 8, bit(bits, 7));
  grid.set(7, 8, bit(bits, 8));
  for (let i = 9; i < 15; i++) grid.set(14 - i, 8, bit(bits, i));
  for (let i = 0; i < 8; i++) grid.set(size - 1 - i, 8, bit(bits, i));
  for (let i = 8; i < 15; i++) grid.set(8, size - 15 + i, bit(bits, i));
  grid.set(8, size - 8, true);
}

function drawCodewords(grid: Grid, codewords: number[]): void {
  const { size } = grid;
  let i = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert++) {
      for (let j = 0; j < 2; j++) {
        const x = right - j;
        const upward = ((right + 1) & 2) === 0;
        const y = upward ? size - 1 - vert : vert;
        if (!grid.fixed[y]?.[x] && i < codewords.length * 8) {
          grid.set(x, y, bit(codewords[i >>> 3] ?? 0, 7 - (i & 7)), false);
          i++;
        }
      }
    }
  }
}

const MASKS: ((x: number, y: number) => boolean)[] = [
  (x, y) => (x + y) % 2 === 0,
  (_x, y) => y % 2 === 0,
  (x) => x % 3 === 0,
  (x, y) => (x + y) % 3 === 0,
  (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0,
  (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
  (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0,
  (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
];

function applyMask(grid: Grid, mask: number): void {
  const test = MASKS[mask];
  if (!test) return;
  for (let y = 0; y < grid.size; y++) {
    for (let x = 0; x < grid.size; x++) {
      if (!grid.fixed[y]?.[x] && test(x, y)) {
        const row = grid.modules[y];
        if (row) row[x] = !row[x];
      }
    }
  }
}

/** Lower is better: runs, 2x2 blocks, finder-like patterns and dark/light balance. */
function penalty(modules: boolean[][]): number {
  const size = modules.length;
  const at = (x: number, y: number): boolean => modules[y]?.[x] ?? false;
  let score = 0;
  for (const horizontal of [true, false]) {
    for (let a = 0; a < size; a++) {
      let run = 1;
      let history = "";
      for (let b = 0; b < size; b++) {
        const cur = horizontal ? at(b, a) : at(a, b);
        history += cur ? "1" : "0";
        if (b > 0 && cur === (horizontal ? at(b - 1, a) : at(a, b - 1))) {
          run++;
          if (run === 5) score += 3;
          else if (run > 5) score++;
        } else run = 1;
      }
      for (let i = 0; i + 11 <= history.length; i++) {
        const window = history.slice(i, i + 11);
        if (window === "00001011101" || window === "10111010000") score += 40;
      }
    }
  }
  let dark = 0;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (at(x, y)) dark++;
      if (x + 1 < size && y + 1 < size && at(x, y) === at(x + 1, y) && at(x, y) === at(x, y + 1) && at(x, y) === at(x + 1, y + 1)) score += 3;
    }
  }
  const total = size * size;
  score += (Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1) * 10;
  return score;
}

/** The module matrix (true = dark) for `text`, without the quiet zone. Throws if it does not fit. */
export function qrModules(text: string): boolean[][] {
  const bytes = toBytes(text);
  let version = 1;
  const needed = (v: number) => 4 + (v <= 9 ? 8 : 16) + bytes.length * 8;
  while (version <= MAX_VERSION && needed(version) > dataCodewords(version) * 8) version++;
  if (version > MAX_VERSION) throw new RangeError("Text is too long for the QR code");

  const codewords = addEccAndInterleave(buildCodewords(bytes, version), version);
  let best: Grid | null = null;
  let bestScore = Infinity;
  for (let mask = 0; mask < 8; mask++) {
    const grid = new Grid(sizeOf(version));
    drawFunctionPatterns(grid, version);
    drawCodewords(grid, codewords);
    applyMask(grid, mask);
    drawFormat(grid, mask);
    const score = penalty(grid.modules);
    if (score < bestScore) {
      best = grid;
      bestScore = score;
    }
  }
  return (best as Grid).modules;
}

/** SVG path data for the dark modules, one rectangle per horizontal run. Units are modules. */
export function qrPath(modules: boolean[][], quiet = 0): string {
  const parts: string[] = [];
  modules.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      if (!row[x]) {
        x++;
        continue;
      }
      let end = x;
      while (row[end]) end++;
      parts.push(`M${x + quiet} ${y + quiet}h${end - x}v1h-${end - x}z`);
      x = end;
    }
  });
  return parts.join("");
}
