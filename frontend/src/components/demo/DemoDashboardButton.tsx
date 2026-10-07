import type { ReactNode } from "react";

import { isDemoEnabled } from "@/lib/demo";

/**
 * "View Demo Dashboard": a plain form POST to the staff app's demo entry. A form, not a `<Link>`, so the
 * public pages never prefetch or load any staff code (research R12), and it works without JavaScript.
 * The caller styles the button (the public site and the staff sign-in page use different stylesheets).
 */
export function DemoDashboardButton({ className, children = "View Demo Dashboard" }: { className?: string; children?: ReactNode }) {
  if (!isDemoEnabled()) return null;
  return (
    <form method="post" action="/admin/demo/start" data-demo-entry="">
      <button type="submit" className={className}>
        {children}
      </button>
    </form>
  );
}
