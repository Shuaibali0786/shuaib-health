import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { LoginPanel } from "@/admin/auth/LoginPanel";
import { SESSION_COOKIE } from "@/admin/lib/cookie";
import { safeNextPath } from "@/admin/lib/nextPath";
import { getViewer } from "@/admin/lib/server";
import { Brand } from "@/admin/shell/Brand";
import { DemoDashboardButton } from "@/components/demo/DemoDashboardButton";
import { getSiteConfig } from "@/lib/content";
import { isDemoEnabled } from "@/lib/demo";
import { PoweredBy } from "@/components/brand/PoweredBy";
import { CREDIT } from "@/lib/honesty";

export const metadata: Metadata = { title: "Sign in" };
export const dynamic = "force-dynamic";

const DEMO_NOTES: Record<string, string> = {
  busy: "The demo is busy — try again in a minute.",
  unavailable: "The demo is not available right now. Please try again shortly.",
};

export default async function LoginPage({ searchParams }: PageProps<"/admin/login">) {
  const query = await searchParams;
  const next = safeNextPath(query.next);
  const demoNote = typeof query.demo === "string" ? DEMO_NOTES[query.demo] : undefined;

  // A signed-in staff member goes straight on; the sign-in form is for everyone else, demo visitors
  // included (signing in ends the demo).
  const current = await getViewer();
  if (current.kind === "ok" && current.viewer.kind === "staff" && !current.viewer.mustChangePassword) redirect(next);

  // Someone whose demo has just run out is offered a fresh one, not a password they never had.
  const demoEnded = current.kind === "signed-out" && (await cookies()).get(SESSION_COOKIE)?.value.startsWith("cd_") === true;
  const site = await getSiteConfig();
  return (
    <main id="main-content" className="auth-wrap">
      <div className="auth-card">
        <div className="brand-row">
          <Brand clinicName={site.name} tone="auto" />
        </div>
        <h1>Sign in</h1>
        <p className="lead">Staff only. Use the email and password your administrator gave you.</p>
        <LoginPanel next={next} />
        {isDemoEnabled() ? (
          <div className="auth-demo">
            <span className="auth-or">or</span>
            {demoEnded && !demoNote ? <p className="auth-demo-note">Your demo has ended. Start a fresh one to keep exploring.</p> : null}
            {demoNote ? (
              <p className="auth-demo-note" role="status">
                {demoNote}
              </p>
            ) : null}
            <DemoDashboardButton className="btn btn-gold btn-lg btn-block">
              {demoEnded ? "Start a fresh demo" : "View Demo Dashboard"}
            </DemoDashboardButton>
            <p className="auth-demo-help">A read-only tour with sample data. No password needed.</p>
          </div>
        ) : null}
        <p className="auth-credit">
          <a href={CREDIT.href} target="_blank" rel="noopener noreferrer">
            {CREDIT.text}
          </a>
        </p>
        <p className="auth-powered">
          <PoweredBy tone="auto" />
        </p>
      </div>
    </main>
  );
}
