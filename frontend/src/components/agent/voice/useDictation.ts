"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { createBrowserSpeech } from "@/voice/browserSpeech";
import type { Notice } from "@/voice/session";
import type { ListenLang, SpeechPort } from "@/voice/types";

const LISTEN_CODE: Record<ListenLang, string> = { en: "en-PK", ur: "ur-PK" };
const MAX_DICTATION_MS = 15_000;

/**
 * Dictation into the chat box (the Mic button): the words appear in the box for editing and nothing is sent until
 * the person presses Send. It listens for one phrase, or until they press the button again, then stops. The words
 * go to the browser's own speech recognition; this site never records or stores audio.
 */
export function useDictation(options: { lang: ListenLang; getDraft: () => string; setDraft: (text: string) => void; onNotice: (notice: Notice) => void }) {
  const [active, setActive] = useState(false);
  const port = useRef<SpeechPort | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef(options);
  useEffect(() => {
    latest.current = options;
  });

  const stop = useCallback(() => {
    port.current?.stopListening();
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setActive(false);
  }, []);

  const start = useCallback(() => {
    port.current ??= createBrowserSpeech();
    if (!port.current.canListen) {
      latest.current.onNotice("listen_unsupported");
      return;
    }
    const base = latest.current.getDraft().trim();
    const join = (text: string) => (base ? `${base} ${text}` : text);
    setActive(true);
    port.current.listen(LISTEN_CODE[latest.current.lang], {
      onInterim: (text) => latest.current.setDraft(join(text)),
      onFinal: (text) => {
        latest.current.setDraft(join(text));
        stop();
      },
      onError: (code) => {
        if (code === "silence") return;
        stop();
        latest.current.onNotice(code === "denied" ? "mic_denied" : code === "network" ? "network" : "mic_unavailable");
      },
    });
    timer.current = setTimeout(stop, MAX_DICTATION_MS);
  }, [stop]);

  useEffect(() => stop, [stop]);

  return { active, toggle: () => (active ? stop() : start()) };
}
