/** The session cookie. `__Host-` makes the browser require Secure, Path=/ and no Domain (website-admin.md §2). */
export const SESSION_COOKIE = "__Host-cc_session";

/** Feature 011: the second sign-in step. Holds the backend challenge token for at most 5 minutes; httpOnly. */
export const CHALLENGE_COOKIE = "__Host-cc_2fa";
