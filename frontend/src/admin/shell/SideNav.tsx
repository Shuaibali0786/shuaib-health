"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import type { Viewer } from "@/admin/lib/schemas";

import { isActive, visibleNavItems } from "./nav";

/**
 * Side navigation for 901 px and up. Items follow the viewer's role. `prefetch={false}` keeps the
 * staff pages from being fetched in the background: every one of them is private and per-request.
 */
export function SideNav({ viewer }: { viewer: Pick<Viewer, "kind" | "role"> }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Main">
      <ul className="nav">
        {visibleNavItems(viewer).map(({ href, label, icon: Icon, adminOnly }) => (
          <li key={href}>
            <Link href={href} prefetch={false} aria-current={isActive(href, pathname) ? "page" : undefined}>
              <Icon className="i" aria-hidden="true" />
              {label}
              {adminOnly ? <span className="badge">Admin</span> : null}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
