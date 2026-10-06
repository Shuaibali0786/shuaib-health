import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { LoginPanel } from "@/admin/auth/LoginPanel";
import { safeNextPath } from "@/admin/lib/nextPath";
import { getViewer } from "@/admin/lib/server";
import { Brand } from "@/admin/shell/Brand";
import { getSiteConfig } from "@/lib/content";
import { CREDIT } from "@/lib/honesty";

export const metadata: Metadata = { title: "Sign in" };
export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: PageProps<"/admin/login">) {
  const next = safeNextPath((await searchParams).next);

  // Someone who is already signed in goes straight on; the sign-in form is for everyone else.
  const current = await getViewer();
  if (current.kind === "ok" && !current.viewer.mustChangePassword) redirect(next);

  const site = await getSiteConfig();
  return (
    <main id="main-content" className="auth-wrap">
      <div className="auth-card">
        <div className="brand-row">
          <Brand clinicName={site.name} />
        </div>
        <h1>Sign in</h1>
        <p className="lead">Staff only. Use the email and password your administrator gave you.</p>
        <LoginPanel next={next} />
        <p className="auth-credit">
          <a href={CREDIT.href} target="_blank" rel="noopener noreferrer">
            {CREDIT.text}
          </a>
        </p>
      </div>
    </main>
  );
}
