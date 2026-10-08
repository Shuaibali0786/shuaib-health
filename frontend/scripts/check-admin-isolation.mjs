// Proves the staff app (Command Centre) is isolated from the public site in a production build
// (ADR 0008, specs/006-clinic-command-centre/contracts/website-admin.md section 5):
//   1. no public route loads a script or stylesheet chunk that carries admin code or admin styles;
//   2. no prerendered public page, and no public client-reference manifest, contains the admin marker,
//      admin CSS, the admin display font or a path under src/admin;
//   3. the check is not vacuous: admin chunks that carry the marker and admin CSS do exist.
// Usage: npm run build && node scripts/check-admin-isolation.mjs [distDir]   (default distDir: .next)
// With --sizes it also prints the first-load JavaScript of every public route.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const args = process.argv.slice(2);
const showSizes = args.includes("--sizes");
const dist = resolve(args.find((a) => !a.startsWith("--")) ?? ".next");

const MARKER = "__SH_COMMAND_CENTRE__";
// Strings that appear in the admin stylesheet or its fonts and nowhere in the public one.
const ADMIN_CSS_TOKENS = ["--color-night-", "bottom-nav", "data-theme-pref", "live-pill", "Cormorant Garamond"];
const ADMIN_PATH_TOKENS = ["src/admin/", "(admin)"];

const fail = [];
const note = (message) => fail.push(message);

function walk(dir, filter, out = []) {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) walk(path, filter, out);
    else if (filter(path)) out.push(path);
  }
  return out;
}

const norm = (path) => path.split("\\").join("/").replace(/^\.?\/?/, "");
const read = (path) => readFileSync(path, "utf8");

if (!existsSync(join(dist, "static"))) {
  console.error(`No production build found in ${dist}. Run "npm run build" first.`);
  process.exit(2);
}

// Every script and stylesheet chunk, and whether it carries admin code or admin styles.
const chunks = new Map(); // "static/chunks/x.js" -> { text, admin }
for (const file of walk(join(dist, "static"), (p) => /\.(js|css)$/.test(p))) {
  const text = read(file);
  const isCss = file.endsWith(".css");
  const admin = text.includes(MARKER) || (isCss && ADMIN_CSS_TOKENS.some((token) => text.includes(token)));
  chunks.set(norm(relative(dist, file)), { text, admin, isCss });
}
const adminScripts = [...chunks].filter(([, c]) => !c.isCss && c.text.includes(MARKER));
const adminStyles = [...chunks].filter(([, c]) => c.isCss && ADMIN_CSS_TOKENS.some((t) => c.text.includes(t)));

const statsPath = join(dist, "diagnostics", "route-bundle-stats.json");
const stats = existsSync(statsPath) ? JSON.parse(read(statsPath)) : [];
const isAdminRoute = (route) => route === "/admin" || route.startsWith("/admin/") || route.startsWith("/api/admin");
const publicRoutes = stats.filter((s) => !isAdminRoute(s.route));

// 1. Public routes load no admin chunk.
for (const { route, firstLoadChunkPaths } of publicRoutes) {
  for (const chunk of firstLoadChunkPaths ?? []) {
    const name = norm(chunk);
    if (chunks.get(name)?.admin) note(`public route ${route} loads admin chunk ${name}`);
  }
}

// 2a. Prerendered public pages (CSS is inlined into the HTML) carry nothing from the admin app.
const htmlRoot = join(dist, "server", "app");
const publicHtml = walk(htmlRoot, (p) => p.endsWith(".html") && !norm(p).includes("(admin)") && !norm(relative(htmlRoot, p)).startsWith("admin"));
for (const file of publicHtml) {
  const text = read(file);
  for (const token of [MARKER, ...ADMIN_CSS_TOKENS]) {
    if (text.includes(token)) note(`${norm(relative(dist, file))} contains "${token}"`);
  }
}

// 2b. Public client-reference manifests list no admin module and no admin stylesheet.
const manifests = walk(htmlRoot, (p) => p.endsWith("_client-reference-manifest.js") && norm(p).includes("/(site)/"));
for (const file of manifests) {
  const text = read(file);
  for (const token of ADMIN_PATH_TOKENS) {
    if (text.includes(token)) note(`${norm(relative(dist, file))} references "${token}"`);
  }
  for (const [, css] of text.matchAll(/"path":"(static\/chunks\/[^"]+\.css)"/g)) {
    if (chunks.get(css)?.admin) note(`${norm(relative(dist, file))} lists admin stylesheet ${css}`);
  }
}

// 3. Not vacuous.
if (adminScripts.length === 0) note(`no script chunk contains ${MARKER}: the marker is not reaching the admin bundle`);
if (adminStyles.length === 0) note("no stylesheet contains the admin tokens: the admin CSS was not built");
if (publicRoutes.length < 10) note(`only ${publicRoutes.length} public routes found in route-bundle-stats.json`);
if (publicHtml.length < 10) note(`only ${publicHtml.length} prerendered public pages found`);
if (manifests.length < 10) note(`only ${manifests.length} public client-reference manifests found`);

if (showSizes) {
  const rows = publicRoutes.map((s) => [s.route, (s.firstLoadUncompressedJsBytes / 1024).toFixed(1)]).sort((a, b) => Number(b[1]) - Number(a[1]));
  console.log("Public route first-load JS (uncompressed, kB):");
  for (const [route, kb] of rows) console.log(`  ${route.padEnd(48)} ${kb}`);
  console.log(`  whole static JS: ${[...chunks].filter(([, c]) => !c.isCss).length} files`);
}

if (fail.length > 0) {
  console.error(`Admin isolation FAILED (${fail.length}):`);
  for (const line of fail) console.error(`  - ${line}`);
  process.exit(1);
}
console.log(
  `Admin isolation OK: ${publicRoutes.length} public routes, ${publicHtml.length} prerendered pages and ${manifests.length} manifests are clean; ` +
    `admin code is in ${adminScripts.length} script and ${adminStyles.length} stylesheet chunk(s).`,
);
