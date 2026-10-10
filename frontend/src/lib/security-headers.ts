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
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
];

/** Headers for every route, including the staff pages (which keep their own private headers on top). */
export function commonSecurityHeaders(mode: SecurityHeadersMode): HeaderEntry[] {
  if (mode === "off") return [];
  return [
    // No `preload`: that is a one-way door the owner has not chosen.
    { key: "Strict-Transport-Security", value: "max-age=31536000" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  ];
}

/**
 * Referrer policy and CSP for the public site only. The staff routes already send their own
 * `Referrer-Policy` and `Content-Security-Policy` (PRIVATE_HEADERS); they must stay unchanged in every mode.
 */
export function publicSiteHeaders(mode: SecurityHeadersMode): HeaderEntry[] {
  if (mode === "off") return [];
  const csp = CSP_DIRECTIVES.join("; ");
  return [
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    mode === "report"
      ? { key: "Content-Security-Policy-Report-Only", value: csp }
      : { key: "Content-Security-Policy", value: `${csp}; frame-ancestors 'none'` },
  ];
}

/** Every path except the staff pages and their BFF. */
export const PUBLIC_SITE_SOURCE = "/((?!admin|api/admin).*)";
