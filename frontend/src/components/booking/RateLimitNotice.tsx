"use client";

import { useEffect, useState } from "react";

/** The longest wait shown, whatever the server asks for. */
export const MAX_COOLDOWN_SECONDS = 120;

interface RateLimitNoticeProps {
  /** Seconds from the server's `Retry-After`; capped at MAX_COOLDOWN_SECONDS. */
  seconds: number;
  /** Where to show the clinic phone line (already formatted by the flow). */
  phone: React.ReactNode;
  onElapsed: () => void;
}

/**
 * "Too many attempts": the message is announced once; the countdown beneath it updates silently.
 * Confirm stays disabled by the flow until `onElapsed` fires.
 */
export function RateLimitNotice({ seconds, phone, onElapsed }: RateLimitNoticeProps) {
  const start = Math.min(MAX_COOLDOWN_SECONDS, Math.max(1, Math.ceil(seconds)));
  const [left, setLeft] = useState(start);

  useEffect(() => {
    const timer = window.setInterval(() => setLeft((value) => value - 1), 1000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    if (left <= 0) onElapsed();
  }, [left, onElapsed]);

  return (
    <div className="rounded-card border-2 border-danger-700 bg-danger-50 p-4 text-base">
      <p role="alert">Too many attempts. Please try again later or call the clinic{phone}.</p>
      <p data-testid="booking-cooldown" className="mt-2 font-semibold">
        You can try again in {Math.max(0, left)} {left === 1 ? "second" : "seconds"}.
      </p>
    </div>
  );
}
