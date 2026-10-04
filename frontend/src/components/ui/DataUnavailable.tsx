import type { PhoneNumber } from "@/types/content";

import { EmptyState } from "./EmptyState";

interface DataUnavailableProps {
  title?: string;
  /** When given, a "Call the clinic" link is shown; otherwise a link to the contact page. */
  phone?: PhoneNumber;
  /** Where "Try again" goes. Defaults to the current page. */
  href?: string;
}

const linkClass =
  "inline-flex min-h-11 items-center justify-center rounded-control border-2 border-navy-900 bg-white px-5 py-2.5 text-base font-semibold text-navy-900 transition-colors hover:bg-surface";

/**
 * Shown in place of a catalog section when the data has never loaded. Friendly wording only: no
 * error codes, no technical terms. The rest of the page keeps rendering around it.
 */
export function DataUnavailable({ title = "This information is temporarily unavailable", phone, href = "?" }: DataUnavailableProps) {
  return (
    <EmptyState title={title} description="Please try again in a few minutes.">
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <a href={href} className={linkClass}>
          Try again
        </a>
        {phone && phone.tel !== "" ? (
          <a href={`tel:${phone.tel}`} className={linkClass}>
            Call the clinic
          </a>
        ) : (
          <a href="/contact" className={linkClass}>
            Contact the clinic
          </a>
        )}
      </div>
    </EmptyState>
  );
}
