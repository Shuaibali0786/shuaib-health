"use client";

/**
 * Live captions under the orb: what the caller is saying (while they talk) and the sentence the assistant is
 * speaking. They repeat what the conversation log already announces to screen readers, so they are hidden from
 * assistive technology to avoid reading everything twice. Text uses `dir="auto"` so Urdu script flows right to left.
 */
export function Captions({ you, assistant }: { you: string; assistant: string | null }) {
  return (
    <div aria-hidden="true" data-testid="voice-captions" className="flex min-h-[4.25rem] w-full flex-col items-center justify-center gap-1 px-5 text-center">
      {you ? (
        <p dir="auto" className="max-w-full text-sm text-ink">
          <span className="font-semibold">You: </span>
          {you}
        </p>
      ) : null}
      {assistant ? (
        <p dir="auto" className="max-w-full text-base leading-snug font-semibold text-navy-900">
          {assistant}
        </p>
      ) : null}
    </div>
  );
}
