import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { PasswordForm } from "@/admin/auth/PasswordForm";
import { SignInForm } from "@/admin/auth/SignInForm";
import { CreateStaffForm } from "@/admin/staff/StaffForms";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), replace: vi.fn(), push: vi.fn() }) }));

// Until the page has hydrated a form could only be submitted natively (a GET that would put the typed
// password in the address bar). The server HTML therefore ships every submit button disabled.
describe("forms are not submittable before hydration", () => {
  const submitButton = (html: string) => /<button[^>]*type="submit"[^>]*>/.exec(html)?.[0] ?? "";

  it.each([
    ["sign-in", <SignInForm key="a" onSignedIn={() => {}} />],
    ["change password", <PasswordForm key="b" forced={false} />],
    ["add staff", <CreateStaffForm key="c" onCreate={async () => true} pending={false} />],
  ])("%s", (_name, element) => {
    expect(submitButton(renderToString(element))).toContain("disabled");
  });
});
