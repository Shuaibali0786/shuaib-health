import Link from "next/link";
import type { ReactNode } from "react";

import { SessionBoundary } from "@/admin/auth/SessionBoundary";
import { SignOutButton } from "@/admin/auth/SignOutButton";
import type { Viewer } from "@/admin/lib/schemas";
import { LiveStatusProvider } from "@/admin/state/liveStatus";
import { CREDIT } from "@/lib/honesty";

import { BottomNav } from "./BottomNav";
import { Brand } from "./Brand";
import { MobileTopBar } from "./MobileTopBar";
import { SideNav } from "./SideNav";
import { StatusBar } from "./StatusBar";
import { initials, roleLabel } from "./nav";

/**
 * The frame of every signed-in screen: the navy side navigation (901 px and up), the sticky top bar
 * and bottom navigation (up to 900 px), the live status line, the main region and the footer credit.
 * Matches the approved design preview at 390 / 1280 / 1366 / 1440 px.
 */
export function AppShell({ viewer, clinicName, serverNow, children }: { viewer: Viewer; clinicName: string; serverNow: string; children: ReactNode }) {
  const name = viewer.displayName ?? "Demo viewer";
  return (
    <LiveStatusProvider>
      <SessionBoundary viewer={viewer} />
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      <div className="shell">
        <aside className="side d-only">
          <div className="brand">
            <Brand clinicName={clinicName} />
          </div>
          <SideNav viewer={viewer} />
          <div className="side-foot">
            <div className="who">
              <div className="avatar" aria-hidden="true">
                {initials(name)}
              </div>
              <div>
                <b>{name}</b>
                <span>{roleLabel(viewer)}</span>
              </div>
            </div>
            {viewer.kind === "staff" ? (
              <Link href="/admin/account/password" prefetch={false} className="btn btn-quiet btn-sm">
                Change password
              </Link>
            ) : null}
            <SignOutButton />
          </div>
        </aside>
        <div className="main">
          <MobileTopBar clinicName={clinicName} />
          <main id="main-content" tabIndex={-1} className="content">
            <StatusBar serverNow={serverNow} timeZone={viewer.timezone} demoDate={viewer.kind === "demo" ? viewer.clinicToday : undefined} />
            {children}
          </main>
          <footer className="foot">
            <span className="credit">
              <a href={CREDIT.href} target="_blank" rel="noopener noreferrer">
                {CREDIT.text}
              </a>
            </span>
          </footer>
        </div>
        <BottomNav viewer={viewer} />
      </div>
    </LiveStatusProvider>
  );
}
