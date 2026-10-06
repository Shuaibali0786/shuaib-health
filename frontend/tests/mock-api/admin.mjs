// Command Centre half of the mock API (contract: specs/006-clinic-command-centre/contracts/website-admin.md §6).
// Serves sign-in, sign-out, change-password, `me` and the staff endpoints; each story adds its endpoints
// here. In memory only. Node built-ins only. Never used in production.
//
// Test sessions (the session cookie value is the token): cs_e2e-admin, cs_e2e-receptionist,
// cs_e2e-must-change (staff) and cd_e2e-demo (demo). Anything else is "not signed in".
//
// Test accounts (password `PASSWORD`): admin@clinic.test, receptionist@clinic.test,
// must-change@clinic.test. `locked@clinic.test` is always locked (429 account_locked, 900 s).

export const ADMIN_MODES = ["admin-down", "admin-slow", "session-expired", "booking-changed"];
export const ADMIN_SLOW_MS = 20_000;
export const PASSWORD = "Correct-Horse-9-Battery";

const TODAY = "2026-10-05"; // Mon 5 Oct 2026 in the clinic, the date the mock "now" falls on
const TIME_ZONE = "Asia/Karachi";
const COMMON = new Set(["password1234", "password12345", "qwertyuiop12"]);

const baseSessions = () => ({
  "cs_e2e-admin": { kind: "staff", role: "admin", displayName: "Sample Admin", mustChangePassword: false, email: "admin@clinic.test" },
  "cs_e2e-receptionist": { kind: "staff", role: "receptionist", displayName: "Sample Receptionist A", mustChangePassword: false, email: "receptionist@clinic.test" },
  "cs_e2e-must-change": { kind: "staff", role: "receptionist", displayName: "Sample Receptionist B", mustChangePassword: true, email: "must-change@clinic.test" },
  "cd_e2e-demo": { kind: "demo" },
});

const baseStaff = () => [
  { id: "11111111-1111-4111-8111-111111111111", email: "admin@clinic.test", displayName: "Sample Admin", role: "admin", isActive: true, mustChangePassword: false, lastSignInAt: "2026-10-05T04:00:00Z", password: PASSWORD, token: "cs_e2e-admin" },
  { id: "22222222-2222-4222-8222-222222222222", email: "receptionist@clinic.test", displayName: "Sample Receptionist A", role: "receptionist", isActive: true, mustChangePassword: false, lastSignInAt: null, password: PASSWORD, token: "cs_e2e-receptionist" },
  { id: "33333333-3333-4333-8333-333333333333", email: "must-change@clinic.test", displayName: "Sample Receptionist B", role: "receptionist", isActive: true, mustChangePassword: true, lastSignInAt: null, password: PASSWORD, token: "cs_e2e-must-change" },
];

const errorBody = (code, message, extra = {}) => ({ error: { code, message, requestId: "mock", ...extra } });

export const csrfFor = (token) => `csrf-${token}`;

/** The Viewer of a contract (`GET /admin/auth/me`) for a session entry. */
function viewerOf(token, session, now) {
  const expires = new Date(Date.parse(now) + 30 * 60 * 1000).toISOString().replace(/\.\d{3}Z$/, "Z");
  const { email: _email, ...rest } = session;
  return { ...rest, csrfToken: csrfFor(token), clinicToday: TODAY, timezone: TIME_ZONE, sessionExpiresAt: expires };
}

/** The Viewer for one of the fixed test tokens, or null (kept for the unit tests). */
export function viewerFor(token, now) {
  const session = baseSessions()[token];
  return session ? viewerOf(token, session, now) : null;
}

const publicStaff = ({ password: _p, token: _t, ...member }) => member;

export function createAdmin({ now = process.env.MOCK_NOW || "2026-10-05T06:20:45Z", proxySecret = process.env.MOCK_PROXY_SECRET } = {}) {
  const secretOk = (headers) => !proxySecret || headers["x-proxy-secret"] === proxySecret;
  let sessions = baseSessions();
  let staff = baseStaff();
  let counter = 0;

  const reset = () => {
    sessions = baseSessions();
    staff = baseStaff();
    counter = 0;
  };

  const parse = (bodyText) => {
    try {
      return bodyText ? JSON.parse(bodyText) : {};
    } catch {
      return null;
    }
  };
  const invalid = (field) => ({ status: 422, body: errorBody("validation_error", "Some request parameters are invalid.", { details: [{ field, issue: "is invalid" }] }) });
  const weak = (reason) => ({ ...errorBody("weak_password", "That password is not strong enough."), reason });
  const refuse = (status, code, message) => ({ status, body: errorBody(code, message) });

  function issue(member) {
    counter += 1;
    const token = `cs_e2e-issued-${counter}`;
    sessions[token] = { kind: "staff", role: member.role, displayName: member.displayName, mustChangePassword: member.mustChangePassword, email: member.email };
    member.token = token;
    return { token, viewer: viewerOf(token, sessions[token], now) };
  }

  /** The signed-in viewer behind a request, or a ready error result. */
  function gate(headers, mode, { write = false, admin = false, staffOnly = false, readsOnly = false } = {}) {
    if (mode === "session-expired") return { error: refuse(401, "session_expired", "Your session has ended. Please sign in again.") };
    const token = headers["x-session-token"];
    const session = token ? sessions[token] : undefined;
    if (!session) return { error: refuse(401, "not_signed_in", "Please sign in.") };
    if (write && session.kind === "staff" && headers["x-csrf-token"] !== csrfFor(token)) return { error: refuse(403, "csrf_failed", "The request could not be verified.") };
    if (session.mustChangePassword && !readsOnly) return { error: refuse(403, "password_change_required", "Please choose a new password first.") };
    if (session.kind === "demo" && (write || staffOnly)) return { error: refuse(403, "demo_read_only", "The demo is read-only.") };
    if (admin && session.kind === "staff" && session.role !== "admin") return { error: refuse(403, "forbidden", "You do not have access to this.") };
    return { token, session };
  }

  const findById = (id) => staff.find((member) => member.id === id);
  const activeAdmins = () => staff.filter((member) => member.role === "admin" && member.isActive);

  /** `{ entry, run }` for an admin request, or null when the path is not an admin path. */
  function handle({ method, path, headers, bodyText = "", mode }) {
    if (!path.startsWith("/api/v1/admin/")) return null;
    const entry = { method, path: path.replace("/api/v1", ""), mode };
    return {
      entry,
      run() {
        if (!secretOk(headers)) return refuse(403, "forbidden", "Forbidden.");
        const route = path.replace("/api/v1/admin", "");

        if (method === "GET" && route === "/auth/me") {
          if (mode === "session-expired") return refuse(401, "session_expired", "Your session has ended. Please sign in again.");
          const token = headers["x-session-token"];
          const session = token ? sessions[token] : undefined;
          if (!session) return refuse(401, "not_signed_in", "Please sign in.");
          return { status: 200, body: viewerOf(token, session, now) };
        }

        if (method === "POST" && route === "/auth/sign-in") {
          const body = parse(bodyText);
          if (!body || typeof body.email !== "string" || typeof body.password !== "string") return invalid("email");
          const email = body.email.trim().toLowerCase();
          if (email === "locked@clinic.test") {
            return { status: 429, headers: { "Retry-After": "900" }, body: errorBody("account_locked", "Too many attempts. Try again later.", { retryAfterSeconds: 900 }) };
          }
          const member = staff.find((m) => m.email === email);
          if (!member || !member.isActive || member.password !== body.password) return refuse(401, "sign_in_failed", "Email or password is incorrect.");
          member.lastSignInAt = now.replace(/\.\d{3}Z$/, "Z");
          const known = member.token && sessions[member.token];
          if (known && known.mustChangePassword === member.mustChangePassword) {
            return { status: 200, body: { token: member.token, viewer: viewerOf(member.token, sessions[member.token], now) } };
          }
          return { status: 200, body: issue(member) };
        }

        if (method === "POST" && route === "/auth/sign-out") {
          const result = gate(headers, mode, { write: true, readsOnly: true });
          if (result.error) return result.error;
          return { status: 204, body: undefined };
        }

        if (method === "POST" && route === "/auth/change-password") {
          const result = gate(headers, mode, { write: true, staffOnly: true, readsOnly: true });
          if (result.error) return result.error;
          const body = parse(bodyText);
          if (!body) return invalid("newPassword");
          const member = staff.find((m) => m.email === result.session.email);
          if (!member || member.password !== body.currentPassword) return invalid("currentPassword");
          if (typeof body.newPassword !== "string" || body.newPassword.length < 12) return invalid("newPassword");
          if (COMMON.has(body.newPassword.toLowerCase())) return { status: 422, body: weak("too_common") };
          if (body.newPassword === member.password) return { status: 422, body: weak("same_as_current") };
          member.password = body.newPassword;
          member.mustChangePassword = false;
          return { status: 200, body: issue(member) };
        }

        if (route === "/staff" && method === "GET") {
          const result = gate(headers, mode, { admin: true });
          if (result.error) return result.error;
          return { status: 200, body: result.session.kind === "demo" ? [] : staff.map(publicStaff) };
        }

        if (route === "/staff" && method === "POST") {
          const result = gate(headers, mode, { write: true, admin: true });
          if (result.error) return result.error;
          const body = parse(bodyText);
          if (!body || typeof body.email !== "string" || typeof body.displayName !== "string" || !["admin", "receptionist"].includes(body.role)) return invalid("email");
          const email = body.email.trim().toLowerCase();
          if (staff.some((m) => m.email === email)) return refuse(409, "email_taken", "That email is already in use.");
          if (typeof body.temporaryPassword !== "string" || body.temporaryPassword.length < 12 || COMMON.has(body.temporaryPassword.toLowerCase())) {
            return { status: 422, body: weak("too_common") };
          }
          counter += 1;
          const member = { id: `44444444-4444-4444-8444-${String(counter).padStart(12, "0")}`, email, displayName: body.displayName.trim(), role: body.role, isActive: true, mustChangePassword: true, lastSignInAt: null, password: body.temporaryPassword, token: null };
          staff.push(member);
          return { status: 201, body: publicStaff(member) };
        }

        const staffRoute = route.match(/^\/staff\/([0-9a-f-]{36})(\/reset-password)?$/);
        if (staffRoute) {
          const isReset = Boolean(staffRoute[2]);
          if (isReset !== (method === "POST") && !(method === "PATCH" && !isReset)) return refuse(404, "not_found", "Not found.");
          const result = gate(headers, mode, { write: true, admin: true });
          if (result.error) return result.error;
          const member = findById(staffRoute[1]);
          if (!member) return refuse(404, "not_found", "Not found.");
          const body = parse(bodyText);
          if (!body) return invalid("body");
          if (isReset) {
            if (typeof body.temporaryPassword !== "string" || body.temporaryPassword.length < 12) return invalid("temporaryPassword");
            member.password = body.temporaryPassword;
            member.mustChangePassword = true;
            return { status: 204, body: undefined };
          }
          const nextRole = body.role ?? member.role;
          const nextActive = body.isActive ?? member.isActive;
          const leavesAdmin = member.role === "admin" && member.isActive && !(nextRole === "admin" && nextActive);
          if (leavesAdmin && activeAdmins().length === 1) return refuse(409, "last_admin", "There must be at least one active admin.");
          member.role = nextRole;
          member.isActive = nextActive;
          return { status: 200, body: publicStaff(member) };
        }

        return refuse(404, "not_found", "Not found.");
      },
    };
  }

  return { handle, reset };
}
