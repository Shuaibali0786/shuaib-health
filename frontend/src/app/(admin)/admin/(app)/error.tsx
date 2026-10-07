"use client";

import { useEffect, useState } from "react";

import { nextRetry, resetRetries } from "@/admin/state/retry";
import { ErrorState } from "@/admin/ui/States";

/**
 * A screen that failed to load: calm copy, never a status code or a stack. It tries again by itself twice (after
 * 1.5 s, then 3 s) and then waits for the Retry button. The shell around it, with its navigation, stays usable.
 */
export default function AppError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  // Decided once, when this screen appears: how long to wait before trying again, or null when the tries are used up.
  const [delay] = useState(() => nextRetry(Date.now()));
  const waiting = delay !== null;

  useEffect(() => {
    if (delay === null) return;
    const timer = setTimeout(reset, delay);
    return () => clearTimeout(timer);
  }, [delay, reset]);

  return (
    <ErrorState
      title={waiting ? "Can’t reach the clinic system — retrying" : "Still can’t reach the clinic system"}
      onRetry={() => {
        resetRetries();
        reset();
      }}
    >
      {waiting ? "This usually clears in a moment. We are trying again." : "Nothing has been lost. Please try again in a moment."}
    </ErrorState>
  );
}
