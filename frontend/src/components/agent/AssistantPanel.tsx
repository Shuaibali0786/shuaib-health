"use client";

import { Send, X } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState, type FormEvent } from "react";

import { QUICK_REPLIES, welcomeMessage } from "@/agent/localEngine";
import { MAX_QUESTION } from "@/agent/normalize";
import { GUIDE_SUGGESTIONS } from "@/agent/productGuide";
import { getProvider, type ProviderId } from "@/agent/registry";
import { createThrottle } from "@/agent/throttle";
import type { AgentLink, AgentMode, KnowledgePack } from "@/agent/types";
import { cn } from "@/lib/cn";

export type AssistantPanelProps = { pack: KnowledgePack; provider?: ProviderId; onClose: () => void };

type Message = { id: number; from: "you" | "assistant"; text: string; links?: AgentLink[] };

const GUIDE_GREETING = "Hello! I can show a clinic owner what this system includes and how it looks for your specialty.";
const greetingFor = (mode: AgentMode, pack: KnowledgePack) => (mode === "guide" ? GUIDE_GREETING : welcomeMessage(pack));

/**
 * The chat panel (Feature 010): a dialog with an optional Patient / Product guide switch (demo only), the
 * conversation (announced politely to screen readers), suggestion chips and a short input. The conversation
 * lives only in this component's memory: nothing is stored or sent anywhere.
 */
export function AssistantPanel({ pack, provider: providerId = "local", onClose }: AssistantPanelProps) {
  const provider = useMemo(() => getProvider(pack, providerId), [pack, providerId]);
  const throttle = useMemo(() => createThrottle(), []);
  const [mode, setMode] = useState<AgentMode>("patient");
  const [messages, setMessages] = useState<Message[]>(() => [{ id: 0, from: "assistant", text: welcomeMessage(pack) }]);
  const [suggestions, setSuggestions] = useState<string[]>(QUICK_REPLIES.en);
  const [draft, setDraft] = useState("");
  const [paused, setPaused] = useState(false);
  const next = useRef(1);
  const input = useRef<HTMLInputElement>(null);
  const log = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useEffect(() => input.current?.focus(), []);
  // Escape closes the chat wherever focus is (the Send button disables itself after sending).
  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  useEffect(() => {
    if (log.current) log.current.scrollTop = log.current.scrollHeight;
  }, [messages]);

  function push(message: Omit<Message, "id">) {
    const id = next.current++;
    setMessages((list) => [...list, { ...message, id }]);
  }

  function switchMode(to: AgentMode) {
    if (to === mode) return;
    setMode(to);
    setMessages([{ id: next.current++, from: "assistant", text: greetingFor(to, pack) }]);
    setSuggestions(to === "guide" ? GUIDE_SUGGESTIONS : QUICK_REPLIES.en);
  }

  async function ask(question: string) {
    const text = question.trim().slice(0, MAX_QUESTION);
    if (!text || paused) return;
    const allowed = throttle.take();
    if (!allowed.ok) {
      push({ from: "assistant", text: allowed.reason === "session" ? "That is the question limit for this visit. Please reload the page or contact the clinic." : "Please wait a moment before asking again." });
      if (allowed.reason === "minute") {
        setPaused(true);
        window.setTimeout(() => setPaused(false), Math.min(allowed.retryInMs, 60_000));
      }
      return;
    }
    push({ from: "you", text });
    setDraft("");
    const reply = await provider.answer({ mode, question: text });
    push({ from: "assistant", text: reply.text, links: reply.links });
    setSuggestions(reply.suggestions ?? []);
    input.current?.focus();
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    void ask(draft);
  }

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-labelledby={titleId}
      className="assistant-panel fixed inset-x-0 bottom-0 z-50 flex max-h-[85dvh] flex-col overflow-hidden rounded-t-card border border-border bg-white shadow-lift md:inset-x-auto md:right-6 md:bottom-6 md:w-[24rem] md:rounded-card"
    >
      <div className="flex items-center gap-3 border-b-2 border-gold-300 bg-navy-900 px-4 py-3 text-white">
        <div className="min-w-0 flex-1">
          <h2 id={titleId} className="text-base font-semibold text-white">
            Ask {pack.clinic.name}
          </h2>
          <p className="text-xs text-white/80">Instant answers from the clinic&apos;s own information</p>
        </div>
        <button type="button" onClick={onClose} className="inline-flex size-11 items-center justify-center rounded-control hover:bg-white/10" aria-label="Close chat">
          <X className="size-5" aria-hidden="true" />
        </button>
      </div>

      {pack.demo ? (
        <div className="flex gap-1 border-b border-border bg-surface p-1.5" role="group" aria-label="Who is asking">
          {(["patient", "guide"] as const).map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={mode === m}
              onClick={() => switchMode(m)}
              className={cn("min-h-11 flex-1 rounded-control text-sm font-semibold", mode === m ? "bg-white text-navy-900 shadow-soft" : "text-muted hover:text-navy-900")}
            >
              {m === "patient" ? "Patient" : "Clinic owner"}
            </button>
          ))}
        </div>
      ) : null}

      <div ref={log} className="flex-1 space-y-3 overflow-y-auto px-4 py-4" role="log" aria-live="polite" aria-label="Conversation">
        {messages.map((message) => (
          <div key={message.id} className={cn("flex", message.from === "you" ? "justify-end" : "justify-start")}>
            <div className={cn("max-w-[85%] rounded-card px-3.5 py-2.5 text-sm", message.from === "you" ? "bg-navy-900 text-white" : "border border-border bg-surface text-ink")}>
              <span className="sr-only">{message.from === "you" ? "You: " : "Assistant: "}</span>
              <p>{message.text}</p>
              {message.links?.length ? (
                <ul className="mt-2 flex flex-wrap gap-2">
                  {message.links.map((link) => (
                    <li key={link.href}>
                      {/* A plain anchor: no prefetch, so a link to the staff app never loads its code here. */}
                      <a href={link.href} className="inline-flex min-h-9 items-center rounded-pill border border-teal-700 bg-white px-3 text-xs font-semibold text-teal-700 hover:bg-teal-50">
                        {link.label}
                      </a>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </div>
        ))}
      </div>

      {suggestions.length ? (
        <div className="flex gap-2 overflow-x-auto px-4 pb-2" role="group" aria-label="Suggested questions">
          {suggestions.map((s) => (
            <button key={s} type="button" onClick={() => void ask(s)} disabled={paused} className="min-h-11 shrink-0 rounded-pill border border-border bg-white px-3 text-sm whitespace-nowrap text-navy-900 hover:bg-surface disabled:opacity-50">
              {s}
            </button>
          ))}
        </div>
      ) : null}

      <form onSubmit={submit} className="flex items-center gap-2 border-t border-border px-3 py-3">
        <label htmlFor={`${titleId}-q`} className="sr-only">
          Your question
        </label>
        <input
          ref={input}
          id={`${titleId}-q`}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={MAX_QUESTION}
          autoComplete="off"
          placeholder={paused ? "One moment…" : "Type your question"}
          disabled={paused}
          className="min-h-11 min-w-0 flex-1 rounded-control border border-border-strong px-3 text-base text-ink"
        />
        <button type="submit" disabled={paused || !draft.trim()} className="inline-flex size-11 items-center justify-center rounded-control bg-navy-900 text-white disabled:opacity-50" aria-label="Send">
          <Send className="size-5" aria-hidden="true" />
        </button>
      </form>
      <p className="bg-surface px-4 py-2 text-center text-xs text-muted">Portfolio demo — not a real clinic, not medical advice. Please don&apos;t share personal details.</p>
    </div>
  );
}
