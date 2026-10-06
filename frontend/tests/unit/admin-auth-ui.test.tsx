import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as z from "zod";

import { passwordMessage, signInMessage, staffMessage } from "@/admin/auth/copy";
import { SessionBoundary } from "@/admin/auth/SessionBoundary";
import { SignInForm } from "@/admin/auth/SignInForm";
import { AdminApiError, adminRequest, setCsrfToken } from "@/admin/lib/client";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh, replace: vi.fn(), push: vi.fn() }) }));

const VIEWER = { kind: "staff", role: "receptionist", displayName: "Sample Receptionist A", mustChangePassword: false, csrfToken: "csrf-new", clinicToday: "2026-10-05", timezone: "Asia/Karachi" };
const errorBody = (code: string, extra: Record<string, unknown> = {}) => ({ error: { code, message: "m", requestId: "r", ...extra } });
const reply = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(body === null ? null : JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });

let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  refresh.mockClear();
});
afterEach(() => {
  vi.unstubAllGlobals();
  setCsrfToken(null);
});

async function fillAndSubmit(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("Email"), "a@clinic.test");
  await user.type(screen.getByLabelText("Password"), "Typed-Password-1");
  await user.click(screen.getByRole("button", { name: "Sign in" }));
}

describe("SignInForm", () => {
  it("signs in through the same-origin route and reports the viewer", async () => {
    fetchMock.mockResolvedValueOnce(reply(200, VIEWER));
    const onSignedIn = vi.fn();
    render(<SignInForm onSignedIn={onSignedIn} />);
    await fillAndSubmit(userEvent.setup());
    await waitFor(() => expect(onSignedIn).toHaveBeenCalledWith(expect.objectContaining({ csrfToken: "csrf-new" })));
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/admin/session");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({ email: "a@clinic.test", password: "Typed-Password-1" });
  });

  it("shows one generic message for every credential failure and clears the password", async () => {
    fetchMock.mockResolvedValueOnce(reply(401, errorBody("sign_in_failed")));
    render(<SignInForm onSignedIn={vi.fn()} />);
    await fillAndSubmit(userEvent.setup());
    expect(await screen.findByRole("alert")).toHaveTextContent("Email or password is incorrect.");
    expect(screen.getByLabelText("Password")).toHaveValue("");
  });

  it("shows the lockout copy with the minutes from Retry-After", async () => {
    fetchMock.mockResolvedValueOnce(reply(429, errorBody("account_locked", { retryAfterSeconds: 900 }), { "retry-after": "900" }));
    render(<SignInForm onSignedIn={vi.fn()} />);
    await fillAndSubmit(userEvent.setup());
    expect(await screen.findByRole("alert")).toHaveTextContent("Too many attempts — try again in 15 minutes.");
  });

  it("has no sign-up link", () => {
    render(<SignInForm onSignedIn={vi.fn()} />);
    expect(screen.queryByText(/sign up|create account|register/i)).toBeNull();
  });
});

describe("SessionBoundary", () => {
  it("opens a sign-in dialog when a request finds the session over, then refreshes in place", async () => {
    render(<SessionBoundary viewer={{ csrfToken: "csrf-old" }} />);
    expect(screen.queryByRole("dialog")).toBeNull();

    fetchMock.mockResolvedValueOnce(reply(401, errorBody("session_expired")));
    await expect(adminRequest({ path: "overview" }, z.unknown())).rejects.toBeInstanceOf(AdminApiError);
    const dialog = await screen.findByRole("dialog", { name: "Your session has ended" });
    expect(dialog).toBeInTheDocument();

    fetchMock.mockResolvedValueOnce(reply(200, VIEWER));
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Email"), "a@clinic.test");
    await user.type(screen.getByLabelText("Password"), "Typed-Password-1");
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("does not open for a failed sign-in (a 401 that is not a session ending)", async () => {
    render(<SessionBoundary viewer={{ csrfToken: "csrf-old" }} />);
    fetchMock.mockResolvedValueOnce(reply(401, errorBody("sign_in_failed")));
    await expect(adminRequest({ method: "POST", path: "session", body: {} }, z.unknown())).rejects.toBeInstanceOf(AdminApiError);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("sends the session's CSRF token on writes", async () => {
    render(<SessionBoundary viewer={{ csrfToken: "csrf-seeded" }} />);
    fetchMock.mockResolvedValueOnce(reply(200, {}));
    await adminRequest({ method: "POST", path: "staff", body: {} }, z.unknown());
    const headers = (fetchMock.mock.calls[0] as [string, RequestInit])[1].headers as Record<string, string>;
    expect(headers["x-csrf-token"]).toBe("csrf-seeded");
  });
});

describe("error copy", () => {
  const failure = (code: AdminApiError["code"], body: unknown = null, retryAfter: number | null = null) => new AdminApiError(400, code, retryAfter, body);

  it("explains lockouts in minutes, singular and plural", () => {
    expect(signInMessage(failure("account_locked", null, 900))).toBe("Too many attempts — try again in 15 minutes.");
    expect(signInMessage(failure("account_locked", null, 30))).toBe("Too many attempts — try again in 1 minute.");
  });

  it("names the weak-password reason and the wrong current password", () => {
    expect(passwordMessage(failure("weak_password", { reason: "too_common" }))).toMatch(/too common/);
    expect(passwordMessage(failure("validation_error", { error: { details: [{ field: "currentPassword" }] } }))).toBe("Your current password is not correct.");
  });

  it("has the last-admin and email-taken copy for the Staff screen", () => {
    expect(staffMessage(failure("last_admin"))).toBe("There must always be at least one active admin.");
    expect(staffMessage(failure("email_taken"))).toBe("That email is already in use.");
  });
});
