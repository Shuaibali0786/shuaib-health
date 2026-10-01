"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { isActivePath } from "@/lib/routes";
import type { NavItem } from "@/types/content";

interface NavLinksProps {
  items: NavItem[];
  /** "inline" is the desktop header row; "stacked" is the mobile menu list. */
  layout: "inline" | "stacked";
}

/**
 * The navigation list. The current page gets aria-current="page", bold navy
 * text and a teal-600 bar (3.7:1 on white), so it is never marked by colour alone.
 */
export function NavLinks({ items, layout }: NavLinksProps) {
  const pathname = usePathname();
  const inline = layout === "inline";

  return (
    <ul className={cn(inline ? "flex items-center gap-0.5" : "flex flex-col gap-1")}>
      {items.map((item) => {
        const active = isActivePath(pathname, item.href);
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "whitespace-nowrap rounded-control font-semibold transition-colors duration-150",
                inline
                  ? "relative block px-1.5 py-2 text-sm hover:bg-surface hover:text-navy-900"
                  : "flex min-h-12 items-center border-l-4 px-4 text-base hover:bg-surface",
                active
                  ? cn(
                      "text-navy-900",
                      inline
                        ? "after:absolute after:inset-x-1.5 after:bottom-0.5 after:h-0.5 after:rounded-pill after:bg-teal-600"
                        : "border-teal-600 bg-teal-50",
                    )
                  : cn("text-ink", !inline && "border-transparent"),
              )}
            >
              {item.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
