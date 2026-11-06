"use client";

import { MessageCircle } from "lucide-react";
import { useEffect, useRef, useState, type ComponentType } from "react";

import type { KnowledgePack } from "@/agent/types";

import type { AssistantPanelProps } from "./AssistantPanel";

/**
 * The gold "Ask us" button (Feature 010). The panel, the engine and their styles are loaded only on the
 * first click, so pages that never open the chat pay for this small button only.
 */
export function AssistantLauncher({ pack }: { pack: KnowledgePack }) {
  const [Panel, setPanel] = useState<ComponentType<AssistantPanelProps> | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const returnFocus = useRef(false);

  // After the chat closes, focus goes back to the button (which is re-rendered once the panel is gone).
  useEffect(() => {
    if (!open && returnFocus.current) {
      returnFocus.current = false;
      button.current?.focus();
    }
  }, [open]);

  async function show() {
    if (!Panel) {
      setLoading(true);
      try {
        const mod = await import("./AssistantPanel");
        setPanel(() => mod.AssistantPanel);
      } finally {
        setLoading(false);
      }
    }
    setOpen(true);
  }

  function close() {
    returnFocus.current = true;
    setOpen(false);
  }

  return (
    <>
      {open ? null : (
        <button
          ref={button}
          type="button"
          onClick={() => void show()}
          aria-haspopup="dialog"
          aria-busy={loading}
          className="assistant-launcher fixed right-4 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-40 inline-flex min-h-12 items-center gap-2 rounded-pill bg-navy-900 px-5 font-semibold text-white shadow-lift md:right-6 md:bottom-6"
        >
          <MessageCircle className="size-5 text-gold-300" aria-hidden="true" />
          Ask us
        </button>
      )}
      {open && Panel ? <Panel pack={pack} onClose={close} /> : null}
    </>
  );
}
