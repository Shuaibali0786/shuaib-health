"use client";

import { cn } from "@/lib/cn";

/**
 * The caption block under the orb (owner layout 2026-11-09): the assistant's line as ONE clear caption (at most two
 * lines), then "You said: …" in small grey text once the patient has spoken. Both rows keep their height, so nothing
 * moves and nothing can slide over the mic and End buttons. They repeat what the conversation log already announces
 * to screen readers, so they are hidden from assistive technology. `dir="auto"` lets any Urdu flow right to left.
 */
export function Captions({ you, assistant, heard = "", live = false }: { you: string; assistant: string | null; heard?: string; live?: boolean }) {
  const said = you || heard;
  return (
    <div aria-hidden="true" data-testid="voice-captions" className="flex w-full flex-col items-center gap-1 px-5 text-center">
      <p dir="auto" data-testid="voice-caption" className={cn("line-clamp-2 h-[2.75rem] max-w-full text-base leading-[1.375rem] font-semibold text-navy-900 transition-opacity", live ? "opacity-100" : "opacity-70")}>
        {assistant ?? ""}
      </p>
      <p dir="auto" data-testid="voice-heard" className="line-clamp-1 h-5 max-w-full text-xs leading-5 text-muted">
        {said ? (
          <>
            <span className="font-semibold">You said: </span>
            {said}
          </>
        ) : null}
      </p>
    </div>
  );
}
