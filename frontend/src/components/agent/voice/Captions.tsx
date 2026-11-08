"use client";

/**
 * Live captions under the orb: what the caller is saying (while they talk) and the sentence the assistant is
 * speaking. They repeat what the conversation log already announces to screen readers, so they are hidden from
 * assistive technology to avoid reading everything twice. Text uses `dir="auto"` so Urdu script flows right to left.
 */
export function Captions({ you, assistant, heard = "" }: { you: string; assistant: string | null; heard?: string }) {
  return (
    <div aria-hidden="true" data-testid="voice-captions" className="flex min-h-[3.5rem] w-full flex-col items-center justify-center gap-1 px-5 text-center">
      {you ? (
        <p dir="auto" className="max-w-full text-sm text-ink">
          <span className="font-semibold">You: </span>
          {you}
        </p>
      ) : heard ? (
        <p dir="auto" data-testid="voice-heard" className="max-w-full text-xs text-ink">
          <span className="font-semibold">I heard: </span>“{heard}” · Not right? Say it again or type it below.
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
