"use client";

import { useEffect, useImperativeHandle, useRef, type Ref } from "react";

import { startOrb, type OrbEngine, type OrbState } from "./orbEngine";

export type { OrbState };

/** What the panel can ask of the orb. */
export type OrbHandle = { pulse: () => void };

// One hidden swatch per palette colour, in the order of SWATCH_KEYS. They carry token classes, so Tailwind emits
// the variables and the engine reads the colours the browser really shows (light or dark), with no value here.
const SWATCH_CLASSES = ["bg-teal-300", "bg-teal-400", "bg-teal-500", "bg-blue-700", "bg-navy-900", "bg-sky-400"] as const;

type Props = { state: OrbState; ref?: Ref<OrbHandle>; className?: string };

/**
 * The large glowing orb (the Option B panel with Option A's orb): idle drifts, listening breathes, thinking swirls,
 * speaking waves follow the words. The canvas is decoration (hidden from assistive technology); the panel announces
 * the state as text.
 */
export function Orb({ state, ref, className }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const swatches = useRef<HTMLDivElement>(null);
  const engine = useRef<OrbEngine | null>(null);
  const first = useRef(state);

  useImperativeHandle(ref, () => ({ pulse: () => engine.current?.pulse() }), []);

  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    engine.current = startOrb(el, swatches.current, first.current);
    return () => {
      engine.current?.stop();
      engine.current = null;
    };
  }, []);

  useEffect(() => {
    engine.current?.setState(state);
  }, [state]);

  return (
    <>
      <canvas ref={canvas} aria-hidden="true" data-testid="voice-orb" data-state={state} className={className ?? "size-48"} />
      <div ref={swatches} aria-hidden="true" className="hidden">
        {SWATCH_CLASSES.map((cls) => (
          <i key={cls} className={cls} />
        ))}
      </div>
    </>
  );
}
