import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TwoFactorCard } from "@/admin/account/TwoFactorCard";
import { describe as describeEvent } from "@/admin/activity/ActivityFeed";
import { SignInForm } from "@/admin/auth/SignInForm";
import { setCsrfToken } from "@/admin/lib/client";
import { StaffTable } from "@/admin/staff/StaffTable";

// Feature 011: the code step, the Security card, the Staff reset button and the Activity labels.

const VIEWER = { kind: "staff", role: "admin", displayName: "Sample Admin", mustChangePassword: false, csrfToken: "csrf-new", clinicToday: "2026-10-05", timezone: "Asia/Karachi" };
const errorBody = (code: string, extra: Record<string, unknown> = {}) => ({ error: { code, message: "m", requestId: "r" }, ...extra });
const reply = (status: number, body: unknown) =>
  new Response(body === null ? null : JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
  setCsrfToken(null);
});

const sent = (index: number) => {
  const [url, init] = fetchMock.mock.calls[index] as [string, RequestInit];
  return { url, body: init.body ? JSON.parse(init.body as string) : undefined };
};

async function passwordStep(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("Email"), "a@clinic.test");
  await user.type(screen.getByLabelText("Password"), "Typed-Password-1");
  await user.click(screen.getByRole("button", { name: "Sign in" }));
}

describe("sign-in with a code", () => {
  it("asks for the app code after the password and signs in with it", async () => {
    fetchMock.mockResolvedValueOnce(reply(202, { twoFactorRequired: true })).mockResolvedValueOnce(reply(200, VIEWER));
    const onSignedIn = vi.fn();
    const user = userEvent.setup();
    render(<SignInForm onSignedIn={onSignedIn} />);
    await passwordStep(user);
    const field = await screen.findByLabelText("Code from your authenticator app");
    expect(field).toHaveAttribute("autocomplete", "one-time-code");
    expect(field).toHaveAttribute("inputmode", "numeric");
    expect(onSignedIn).not.toHaveBeenCalled();
    await user.type(field, "123 456");
    await user.click(screen.getByRole("button", { name: "Verify and sign in" }));
    await waitFor(() => expect(onSignedIn).toHaveBeenCalledWith(expect.objectContaining({ csrfToken: "csrf-new" })));
    expect(sent(1)).toEqual({ url: "/api/admin/session/two-factor", body: { code: "123456" } });
  });

  it("offers a backup code, says how many tries are left, and starts again when the step ends", async () => {
    fetchMock
      .mockResolvedValueOnce(reply(202, { twoFactorRequired: true }))
      .mockResolvedValueOnce(reply(401, errorBody("two_factor_failed", { attemptsLeft: 2 })))
      .mockResolvedValueOnce(reply(401, errorBody("challenge_expired")));
    const user = userEvent.setup();
    render(<SignInForm onSignedIn={vi.fn()} />);
    await passwordStep(user);
    await user.click(await screen.findByRole("button", { name: "Use a backup code instead" }));
    await user.type(screen.getByLabelText("Backup code"), "abcde-fghjk");
    await user.click(screen.getByRole("button", { name: "Verify and sign in" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("That code did not work. 2 tries left.");
    expect(sent(1).body).toEqual({ backupCode: "abcde-fghjk" });
    await user.type(screen.getByLabelText("Backup code"), "ABCDE-FGHJK");
    await user.click(screen.getByRole("button", { name: "Verify and sign in" }));
    expect(await screen.findByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("This sign-in step has ended. Please sign in again.");
  });
});

describe("Security card", () => {
  it("turns two-step sign-in on: password, QR and key, code, then the backup codes shown once", async () => {
    const codes = Array.from({ length: 10 }, (_, i) => `ABCDE-FGH${String.fromCharCode(74 + i)}${"K"}`.slice(0, 11));
    fetchMock
      .mockResolvedValueOnce(reply(200, { secret: "JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP", otpauthUri: "otpauth://totp/Sample%20Clinic%3Aa@clinic.test?secret=JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP&issuer=Sample%20Clinic&algorithm=SHA1&digits=6&period=30" }))
      .mockResolvedValueOnce(reply(422, errorBody("validation_error", { })))
      .mockResolvedValueOnce(reply(200, { backupCodes: codes }));
    const user = userEvent.setup();
    render(<TwoFactorCard initial={{ available: true, enabled: false, canEnrol: true }} />);
    await user.click(screen.getByRole("button", { name: "Turn on two-step sign-in" }));
    await user.type(screen.getByLabelText("Current password"), "Typed-Password-1");
    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(await screen.findByRole("img", { name: /QR code to add this account/ })).toBeInTheDocument();
    expect(screen.getByText("JBSW Y3DP EHPK 3PXP JBSW Y3DP EHPK 3PXP")).toBeInTheDocument();
    expect(sent(0)).toEqual({ url: "/api/admin/two-factor/setup", body: { currentPassword: "Typed-Password-1" } });

    await user.type(screen.getByLabelText("Code from your authenticator app"), "000000");
    await user.click(screen.getByRole("button", { name: "Turn on" }));
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    await user.type(screen.getByLabelText("Code from your authenticator app"), "123 456");
    await user.click(screen.getByRole("button", { name: "Turn on" }));
    const list = await screen.findByRole("list", { name: "Backup codes" });
    expect(within(list).getAllByRole("listitem")).toHaveLength(10);
    expect(sent(2).body).toEqual({ code: "123456" });
    const done = screen.getByRole("button", { name: "Done" });
    expect(done).toBeDisabled();
    await user.click(screen.getByLabelText("I have saved my backup codes."));
    expect(done).toBeEnabled();
  });

  it("explains when it is not offered", () => {
    // The card keeps its own state, so each case is a fresh render.
    const first = render(<TwoFactorCard initial={{ available: true, enabled: false, canEnrol: false }} />);
    expect(screen.getByText("Two-step sign-in is offered to admin accounts.")).toBeInTheDocument();
    first.unmount();
    const second = render(<TwoFactorCard initial={{ available: false, enabled: false, canEnrol: false }} />);
    expect(screen.getByText("Two-step sign-in is not available on this system yet.")).toBeInTheDocument();
    second.unmount();
    render(<TwoFactorCard initial={null} />);
    expect(screen.getByRole("alert")).toHaveTextContent("could not load");
  });

  it("turns it off with the password and a backup code", async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 })).mockResolvedValueOnce(reply(200, { available: true, enabled: false, canEnrol: true }));
    const user = userEvent.setup();
    render(<TwoFactorCard initial={{ available: true, enabled: true, enabledAt: "2026-10-01T04:00:00Z", backupCodesLeft: 9, canEnrol: false }} />);
    expect(screen.getByText(/9 of 10 backup codes left/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Turn off" }));
    await user.type(screen.getByLabelText("Current password"), "Typed-Password-1");
    await user.click(screen.getByRole("button", { name: "Use a backup code instead" }));
    await user.type(screen.getByLabelText("Backup code"), "ABCDE-FGHJK");
    await user.click(screen.getByRole("button", { name: "Turn off two-step sign-in" }));
    expect(await screen.findByRole("button", { name: "Turn on two-step sign-in" })).toBeInTheDocument();
    expect(sent(0)).toEqual({ url: "/api/admin/two-factor/disable", body: { currentPassword: "Typed-Password-1", backupCode: "ABCDE-FGHJK" } });
  });
});

describe("Staff and Activity", () => {
  const member = (twoFactorEnabled: boolean) => ({ id: "4d6f0a52-5c1f-4a0e-9a47-0c1d2e3f4a5b", email: "b@clinic.test", displayName: "Sample Admin B", role: "admin" as const, isActive: true, twoFactorEnabled });
  const actions = { onRole: vi.fn(), onActive: vi.fn(), onReset: vi.fn(), onResetTwoFactor: vi.fn() };

  it("shows the reset button only for people with two-step sign-in on", async () => {
    const { rerender } = render(<StaffTable staff={[member(true)]} actions={actions} readOnly={false} busyId={null} />);
    expect(screen.getByText("Two-step sign-in on")).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole("button", { name: "Reset two-step sign-in" }));
    expect(actions.onResetTwoFactor).toHaveBeenCalledWith(expect.objectContaining({ displayName: "Sample Admin B" }));
    rerender(<StaffTable staff={[member(false)]} actions={actions} readOnly={false} busyId={null} />);
    expect(screen.queryByRole("button", { name: "Reset two-step sign-in" })).toBeNull();
    rerender(<StaffTable staff={[member(true)]} actions={actions} readOnly busyId={null} />);
    expect(screen.queryByRole("button", { name: "Reset two-step sign-in" })).toBeNull();
  });

  it("names every two-step event in words", () => {
    const base = { id: "4d6f0a52-5c1f-4a0e-9a47-0c1d2e3f4a5b", at: "2026-10-05T04:00:00Z", outcome: "ok", networkTag: "abcd" };
    expect(describeEvent({ ...base, action: "auth.two_factor_enabled" })).toBe("Turned on two-step sign-in");
    expect(describeEvent({ ...base, action: "auth.backup_code_used" })).toBe("Used a backup code");
    expect(describeEvent({ ...base, action: "staff.two_factor_reset" })).toBe("Reset two-step sign-in");
    expect(describeEvent({ ...base, action: "auth.two_factor_failed", outcome: "bad_credentials" })).toBe("Failed sign-in code");
  });
});
