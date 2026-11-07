import { AdminApiError } from "@/admin/lib/client";

// What a person reads when an auth call fails. The wording never says which part of a sign-in was wrong.

export const WEAK_PASSWORD_REASONS: Record<string, string> = {
  too_short: "Use at least 12 characters.",
  too_long: "Use at most 128 characters.",
  too_common: "That password is too common. Choose something less guessable.",
  contains_email: "The password must not contain your email name.",
  same_as_current: "Choose a password different from the current one.",
};

export function minutesFrom(seconds: number | null): number {
  return Math.max(1, Math.ceil((seconds ?? 900) / 60));
}

function reasonOf(error: AdminApiError): string | undefined {
  const body = error.body;
  if (body && typeof body === "object" && "reason" in body && typeof body.reason === "string") return body.reason;
  return undefined;
}

export function signInMessage(error: unknown): string {
  if (!(error instanceof AdminApiError)) return "Something went wrong. Please try again.";
  // The website's own answer when the service is down or too slow (502/503/504).
  if (error.status >= 500) return "We could not reach the service. Check your connection and try again.";
  switch (error.code) {
    case "sign_in_failed":
      return "Email or password is incorrect.";
    case "account_locked": {
      const minutes = minutesFrom(error.retryAfter);
      return `Too many attempts — try again in ${minutes} ${minutes === 1 ? "minute" : "minutes"}.`;
    }
    case "rate_limited":
      return "Too many attempts from this network. Please wait a few minutes and try again.";
    case "network":
    case "timeout":
      return "We could not reach the service. Check your connection and try again.";
    case "validation_error":
      return "Enter your email and password.";
    default:
      return "Something went wrong. Please try again.";
  }
}

export function passwordMessage(error: unknown): string {
  if (!(error instanceof AdminApiError)) return "Something went wrong. Please try again.";
  if (error.code === "weak_password") return WEAK_PASSWORD_REASONS[reasonOf(error) ?? ""] ?? "That password is not strong enough.";
  if (error.code === "validation_error") {
    const first = error.body && typeof error.body === "object" && "error" in error.body ? (error.body as { error: { details?: { field: string }[] } }).error.details?.[0] : undefined;
    if (first?.field === "currentPassword") return "Your current password is not correct.";
    return "Check the passwords and try again.";
  }
  if (error.code === "network" || error.code === "timeout") return "We could not reach the service. Please try again.";
  return "Something went wrong. Please try again.";
}

export function staffMessage(error: unknown): string {
  if (!(error instanceof AdminApiError)) return "Something went wrong. Please try again.";
  switch (error.code) {
    case "email_taken":
      return "That email is already in use.";
    case "last_admin":
      return "There must always be at least one active admin.";
    case "weak_password":
      return WEAK_PASSWORD_REASONS[reasonOf(error) ?? ""] ?? "That password is not strong enough.";
    case "forbidden":
      return "You do not have access to this.";
    case "demo_read_only":
      return "The demo is read-only: changes are not saved.";
    case "not_found":
      return "That person no longer exists. Reload the list.";
    case "two_factor_off":
      return "Two-step sign-in is already off for that person. Reload the list.";
    case "cannot_reset_self":
      return "Use your own Security page to change your two-step sign-in.";
    case "network":
    case "timeout":
      return "We could not reach the service. Please try again.";
    default:
      return "Something went wrong. Please try again.";
  }
}

// Feature 011: two-step sign-in. A wrong code never hints whether the password was right (it was, to get here).
export function attemptsLeftOf(error: AdminApiError): number | null {
  const body = error.body;
  if (body && typeof body === "object" && "attemptsLeft" in body && typeof body.attemptsLeft === "number") return body.attemptsLeft;
  return null;
}

export function twoFactorMessage(error: unknown): string {
  if (!(error instanceof AdminApiError)) return "Something went wrong. Please try again.";
  switch (error.code) {
    case "two_factor_failed": {
      const left = attemptsLeftOf(error);
      return left === null ? "That code did not work. Check your app and try again." : `That code did not work. ${left} ${left === 1 ? "try" : "tries"} left.`;
    }
    case "challenge_expired":
      return "This sign-in step has ended. Please sign in again.";
    case "account_locked": {
      const minutes = minutesFrom(error.retryAfter);
      return `Too many attempts — try again in ${minutes} ${minutes === 1 ? "minute" : "minutes"}.`;
    }
    case "rate_limited":
      return "Too many attempts from this network. Please wait a few minutes and try again.";
    case "two_factor_unavailable":
      return "Two-step sign-in is not available right now. Ask the clinic's technical contact.";
    case "validation_error":
      return "Enter the 6-digit code from your app, or a backup code.";
    case "network":
    case "timeout":
      return "We could not reach the service. Check your connection and try again.";
    default:
      return error.status >= 500 ? "We could not reach the service. Check your connection and try again." : "Something went wrong. Please try again.";
  }
}

/** True when the person must go back to the password step. */
export function endsTwoFactorStep(error: unknown): boolean {
  return error instanceof AdminApiError && (error.code === "challenge_expired" || error.code === "account_locked");
}

export function securityMessage(error: unknown): string {
  if (!(error instanceof AdminApiError)) return "Something went wrong. Please try again.";
  const field = error.body && typeof error.body === "object" && "error" in error.body ? (error.body as { error: { details?: { field: string }[] } }).error.details?.[0]?.field : undefined;
  switch (error.code) {
    case "validation_error":
      if (field === "currentPassword") return "Your current password is not correct.";
      if (field === "code" || field === "backupCode") return "That code did not work. Check your app and try again.";
      return "Check what you typed and try again.";
    case "two_factor_unavailable":
      return "Two-step sign-in is not available on this system yet.";
    case "two_factor_admins_only":
      return "Two-step sign-in is offered to admin accounts.";
    case "two_factor_already_on":
      return "Two-step sign-in is already on. Reload the page.";
    case "two_factor_not_started":
      return "The setup timed out. Start again to get a new key.";
    case "two_factor_off":
      return "Two-step sign-in is off for this account.";
    case "cannot_reset_self":
      return "Use your own Security page to change your two-step sign-in.";
    case "password_change_required":
      return "Choose a new password first, then turn on two-step sign-in.";
    case "account_locked": {
      const minutes = minutesFrom(error.retryAfter);
      return `Too many attempts — try again in ${minutes} ${minutes === 1 ? "minute" : "minutes"}.`;
    }
    case "demo_read_only":
      return "The demo is read-only: changes are not saved.";
    case "network":
    case "timeout":
      return "We could not reach the service. Please try again.";
    default:
      return "Something went wrong. Please try again.";
  }
}
