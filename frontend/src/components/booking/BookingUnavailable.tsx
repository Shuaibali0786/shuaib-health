import { EmptyState } from "@/components/ui/EmptyState";
import type { PhoneNumber } from "@/types/content";

const BUTTON =
  "inline-flex min-h-11 items-center justify-center rounded-control border-2 border-navy-900 bg-white px-5 py-2.5 text-base font-semibold text-navy-900 transition-colors hover:bg-surface";

interface BookingUnavailableProps {
  phone: PhoneNumber;
  /** Shows a Retry button that calls this. Without it, Retry reloads the page. */
  onRetry?: () => void;
}

/** Shown when booking cannot be offered right now (slots or catalog could not be loaded). */
export function BookingUnavailable({ phone, onRetry }: BookingUnavailableProps) {
  return (
    <EmptyState title="Online booking is temporarily unavailable. Please call the clinic.">
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        {phone.tel !== "" ? (
          <a href={`tel:${phone.tel}`} className={BUTTON}>
            Call {phone.display}
          </a>
        ) : null}
        {onRetry ? (
          <button type="button" onClick={onRetry} className={BUTTON}>
            Retry
          </button>
        ) : (
          <a href="?" className={BUTTON}>
            Retry
          </a>
        )}
      </div>
    </EmptyState>
  );
}
