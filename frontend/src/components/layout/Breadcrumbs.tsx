import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { ROUTES } from "@/lib/routes";

export interface Crumb {
  label: string;
  /** Omit on the last item: it is the current page. */
  href?: string;
}

interface BreadcrumbsProps {
  /** The trail after "Home". The last item is the current page. */
  items: Crumb[];
  className?: string;
}

/**
 * Home › Section › Page. The last item is plain text marked `aria-current="page"`. Separators are
 * icons hidden from assistive technology. The trail wraps on narrow screens and each link keeps
 * a 24 px minimum target height.
 */
export function Breadcrumbs({ items, className }: BreadcrumbsProps) {
  const linkClass = "inline-flex min-h-6 items-center text-muted underline-offset-2 hover:text-navy-900 hover:underline";
  return (
    <nav aria-label="Breadcrumb" className={className}>
      <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm">
        <li className="inline-flex items-center">
          <Link href={ROUTES.home} className={linkClass}>
            Home
          </Link>
        </li>
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <li key={`${item.label}-${index}`} className="inline-flex items-center gap-1.5">
              <ChevronRight className="size-4 shrink-0 text-muted" aria-hidden="true" />
              {isLast || !item.href ? (
                <span aria-current={isLast ? "page" : undefined} className={cn("font-semibold text-navy-900", "break-words")}>
                  {item.label}
                </span>
              ) : (
                <Link href={item.href} className={linkClass}>
                  {item.label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
