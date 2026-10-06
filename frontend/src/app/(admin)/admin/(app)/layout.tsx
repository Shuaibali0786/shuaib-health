import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { getViewer } from "@/admin/lib/server";
import { AppShell } from "@/admin/shell/AppShell";
import { ErrorState } from "@/admin/ui/States";
import { getSiteConfig } from "@/lib/content";

// Every signed-in screen is private and per request.
export const dynamic = "force-dynamic";

const PASSWORD_PAGE = "/admin/account/password";

/** The pathname the proxy recorded, if it is a plain /admin path; never a query string or another host. */
async function requestedPath(): Promise<string> {
  const value = (await headers()).get("x-cc-pathname") ?? "";
  return /^\/admin(\/[A-Za-z0-9._~-]+)*$/.test(value) ? value : "/admin";
}

export default async function AuthenticatedLayout({ children }: LayoutProps<"/admin">) {
  const result = await getViewer();

  if (result.kind === "signed-out") {
    redirect(`/admin/login?next=${encodeURIComponent(await requestedPath())}`);
  }

  if (result.kind === "unavailable") {
    return (
      <main id="main-content" className="content">
        <ErrorState title="The Command Centre is not available right now">
          Please try again in a moment. <a href="">Reload</a>
        </ErrorState>
      </main>
    );
  }

  // A temporary or reset password must be replaced before anything else (the backend refuses reads too).
  if (result.viewer.mustChangePassword && (await requestedPath()) !== PASSWORD_PAGE) redirect(PASSWORD_PAGE);

  const site = await getSiteConfig();
  return (
    <AppShell viewer={result.viewer} clinicName={site.name} serverNow={new Date().toISOString()}>
      {children}
    </AppShell>
  );
}
