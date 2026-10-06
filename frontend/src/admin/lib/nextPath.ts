/**
 * The page to return to after sign-in. Only a plain same-site `/admin` path is accepted (letters, digits
 * and `._~-` per segment, no query string, no `//`, no scheme or host); anything else is `/admin`,
 * so the login page cannot be used as an open redirect (contracts/website-admin.md §1).
 */
export function safeNextPath(value: string | string[] | null | undefined): string {
  const raw = Array.isArray(value) ? value[0] : value;
  if (typeof raw !== "string") return "/admin";
  return /^\/admin(\/[A-Za-z0-9._~-]+)*\/?$/.test(raw) && !raw.includes("..") ? raw : "/admin";
}
