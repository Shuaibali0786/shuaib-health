"use client";

import { Printer } from "lucide-react";

/**
 * "Print list" (Feature 008, US3): the browser's own print dialog. The print styles in `admin.css` hide
 * navigation, filters and buttons; phones stay masked exactly as on screen, so printing reveals nothing
 * and needs no audit event.
 */
export function PrintButton() {
  return (
    <button type="button" className="btn btn-sm print-button" onClick={() => window.print()}>
      <Printer className="i i-sm" aria-hidden="true" />
      Print list
    </button>
  );
}
