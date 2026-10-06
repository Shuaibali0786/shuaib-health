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
    case "network":
    case "timeout":
      return "We could not reach the service. Please try again.";
    default:
      return "Something went wrong. Please try again.";
  }
}
