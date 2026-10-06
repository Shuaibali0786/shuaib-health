"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import type { Viewer } from "@/admin/lib/schemas";

import { isActive, visibleNavItems } from "./nav";

/** Navigation for phones and tablets up to 900 px: fixed to the bottom, 52 px tall targets. */
export function BottomNav({ viewer }: { viewer: Pick<Viewer, "kind" | "role"> }) {
  const pathname = usePathname();
  return (
    <nav className="bottom-nav" aria-label="Main">
      {visibleNavItems(viewer).map(({ href, label, icon: Icon }) => (
        <Link key={href} href={href} prefetch={false} aria-current={isActive(href, pathname) ? "page" : undefined}>
          <Icon className="i" aria-hidden="true" />
          {label}
        </Link>
      ))}
    </nav>
  );
}
