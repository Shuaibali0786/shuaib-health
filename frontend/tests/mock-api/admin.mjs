// Command Centre half of the mock API (contract: specs/006-clinic-command-centre/contracts/website-admin.md §6).
// Phase 2 serves `GET /admin/auth/me`; each story adds its endpoints here. In memory only. Node built-ins
// only. Never used in production.
//
// Test sessions (the session cookie value is the token): cs_e2e-admin, cs_e2e-receptionist,
// cs_e2e-must-change (staff) and cd_e2e-demo (demo). Anything else is "not signed in".

export const ADMIN_MODES = ["admin-down", "admin-slow", "session-expired", "booking-changed"];
export const ADMIN_SLOW_MS = 20_000;

const TODAY = "2026-10-05"; // Mon 5 Oct 2026 in the clinic, the date the mock "now" falls on
const TIME_ZONE = "Asia/Karachi";

const SESSIONS = {
  "cs_e2e-admin": { kind: "staff", role: "admin", displayName: "Sample Admin", mustChangePassword: false },
  "cs_e2e-receptionist": { kind: "staff", role: "receptionist", displayName: "Sample Receptionist A", mustChangePassword: false },
  "cs_e2e-must-change": { kind: "staff", role: "receptionist", displayName: "Sample Receptionist B", mustChangePassword: true },
  "cd_e2e-demo": { kind: "demo" },
};

const errorBody = (code, message) => ({ error: { code, message, requestId: "mock" } });

export const csrfFor = (token) => `csrf-${token}`;

/** The Viewer of a contract (`GET /admin/auth/me`) for a test token, or null. */
export function viewerFor(token, now) {
  const session = SESSIONS[token];
  if (!session) return null;
  const expires = new Date(Date.parse(now) + 30 * 60 * 1000).toISOString().replace(/\.\d{3}Z$/, "Z");
  return {
    ...session,
    csrfToken: csrfFor(token),
    clinicToday: TODAY,
    timezone: TIME_ZONE,
    sessionExpiresAt: expires,
  };
}

export function createAdmin({ now = process.env.MOCK_NOW || "2026-10-05T06:20:45Z", proxySecret = process.env.MOCK_PROXY_SECRET } = {}) {
  const secretOk = (headers) => !proxySecret || headers["x-proxy-secret"] === proxySecret;

  /** `{ entry, run }` for an admin request, or null when the path is not an admin path. */
  function handle({ method, path, headers, mode }) {
    if (!path.startsWith("/api/v1/admin/")) return null;
    const entry = { method, path: path.replace("/api/v1", ""), mode };
    return {
      entry,
      run() {
        if (!secretOk(headers)) return { status: 403, body: errorBody("forbidden", "Forbidden.") };

        if (method === "GET" && path === "/api/v1/admin/auth/me") {
          const token = headers["x-session-token"];
          if (mode === "session-expired") return { status: 401, body: errorBody("session_expired", "Your session has ended. Please sign in again.") };
          const viewer = token ? viewerFor(token, now) : null;
          if (!viewer) return { status: 401, body: errorBody("not_signed_in", "Please sign in.") };
          return { status: 200, body: viewer };
        }
        return { status: 404, body: errorBody("not_found", "Not found.") };
      },
    };
  }

  return { handle, reset() {} };
}
