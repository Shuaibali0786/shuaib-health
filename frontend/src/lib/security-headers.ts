// Site-wide security headers (007, FR-079). Pure and dependency-free: next.config.ts imports it.
// Mode comes from SITE_SECURITY_HEADERS: "off" | "report" | "enforce". Unset means "off" locally,
// but on Vercel (production or preview) it must be set explicitly, so a launch cannot forget it.

export type SecurityHeadersMode = "off" | "report" | "enforce";

export interface HeaderEntry {
  key: string;
  value: string;
}

const MODES: readonly SecurityHeadersMode[] = ["off", "report", "enforce"];

export function securityHeadersMode(env: Record<string, string | undefined>): SecurityHeadersMode {
  const raw = env.SITE_SECURITY_HEADERS?.trim().toLowerCase();
  if (!raw) {
    if (env.VERCEL_ENV === "production" || env.VERCEL_ENV === "preview") {
      throw new Error("SITE_SECURITY_HEADERS must be set explicitly on Vercel (off, report or enforce).");
    }
    return "off";
  }
  if ((MODES as readonly string[]).includes(raw)) return raw as SecurityHeadersMode;
  throw new Error("SITE_SECURITY_HEADERS must be off, report or enforce.");
}

// The site is server-rendered with inline hydration scripts and inlined CSS, so inline is allowed
// until a nonce-based policy is worth its cost. Everything else is same-origin only.
const CSP_DIRECTIVES = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  // The contact page shows an OpenStreetMap area only after the visitor clicks "Show map".
  "frame-src https://www.openstreetmap.org",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
];

/**
 * Where the browser sends CSP violation reports: the Sentry "security" endpoint of the website project,
 * read from CSP_REPORT_URI (a public ingest address that carries a public key, not a secret, but kept
 * out of the code). Unset means no reporting. Anything but a plain https URL fails the build, so a typo
 * cannot inject extra CSP directives.
 */
export function cspReportUri(env: Record<string, string | undefined>): string | undefined {
  const raw = env.CSP_REPORT_URI?.trim();
  if (!raw) return undefined;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("CSP_REPORT_URI must be a valid https URL.");
  }
  if (url.protocol !== "https:" || /[;,\s]/.test(raw)) {
    throw new Error("CSP_REPORT_URI must be a plain https URL (no spaces, commas or semicolons).");
  }
  return url.href;
}

/** Headers for every route, including the staff pages (which keep their own private headers on top). */
export function commonSecurityHeaders(mode: SecurityHeadersMode, options: { microphone?: boolean } = {}): HeaderEntry[] {
  // Feature 013: with voice on, this site's own pages (never a frame or another origin) may ask for the microphone.
  const microphone = options.microphone ? "microphone=(self)" : "microphone=()";
  if (mode === "off") return [];
  return [
    // No `preload`: that is a one-way door the owner has not chosen.
    { key: "Strict-Transport-Security", value: "max-age=31536000" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "Permissions-Policy", value: `camera=(), ${microphone}, geolocation=(), payment=(), usb=()` },
  ];
}

/**
 * Referrer policy and CSP for the public site only. The staff routes already send their own
 * `Referrer-Policy` and `Content-Security-Policy` (PRIVATE_HEADERS); they must stay unchanged in every mode.
 */
export function publicSiteHeaders(mode: SecurityHeadersMode, reportUri?: string): HeaderEntry[] {
  if (mode === "off") return [];
  const csp = (reportUri ? [...CSP_DIRECTIVES, `report-uri ${reportUri}`] : CSP_DIRECTIVES).join("; ");
  return [
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    mode === "report"
      ? { key: "Content-Security-Policy-Report-Only", value: csp }
      : { key: "Content-Security-Policy", value: `${csp}; frame-ancestors 'none'` },
  ];
}

// The staff app uses the same sources as the site, minus anything it never needs (no frames, no map).
// Inline scripts stay allowed for the same reason as on the public site (Next's hydration scripts).
const STAFF_CSP_DIRECTIVES = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
];

/**
 * The staff Content-Security-Policy (/admin, /api/admin). Off: only `frame-ancestors 'none'`, as before the
 * script policy existed. Report: that same enforced header plus the full policy as Report-Only, so a staff
 * page that needs another source shows up as a report instead of a broken screen. Enforce: the full policy.
 */
export function staffCspHeaders(mode: SecurityHeadersMode, reportUri?: string): HeaderEntry[] {
  const framing: HeaderEntry = { key: "Content-Security-Policy", value: "frame-ancestors 'none'" };
  if (mode === "off") return [framing];
  const full = (reportUri ? [...STAFF_CSP_DIRECTIVES, `report-uri ${reportUri}`] : STAFF_CSP_DIRECTIVES).join("; ");
  return mode === "report"
    ? [framing, { key: "Content-Security-Policy-Report-Only", value: full }]
    : [{ key: "Content-Security-Policy", value: full }];
}

/** Every path except the staff pages and their BFF. */
export const PUBLIC_SITE_SOURCE = "/((?!admin|api/admin).*)";
