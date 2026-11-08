"use client";

import { useEffect, useRef, type MutableRefObject } from "react";

import type { VoiceState } from "@/voice/types";

/** The orb's four looks. "paused" (muted) is drawn like idle. */
export type OrbState = VoiceState;

type Rgb = readonly [number, number, number];
type Palette = Record<"highlight" | "light" | "mid" | "deep" | "night" | "sky", Rgb | null>;

const rgba = (c: Rgb | null, alpha: number): string => (c ? `rgb(${c[0]} ${c[1]} ${c[2]} / ${alpha})` : `rgb(128 128 128 / ${alpha})`);

/** Reads "rgb(20, 184, 166)" (what browsers report for a token colour) into channels. */
export function parseRgb(value: string): Rgb | null {
  const m = /rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/.exec(value);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

type Frame = { time: number; state: OrbState; energy: number };

/**
 * Draws one frame. Pure (it only talks to the 2D context it is given), so tests can run it against a recorder.
 *   idle: a slow drift   listening: it breathes   thinking: it swirls   speaking: waves follow the speech.
 */
export function drawOrb(ctx: CanvasRenderingContext2D, width: number, height: number, frame: Frame, palette: Palette): void {
  const { time: t, state, energy } = frame;
  const cx = width / 2;
  const cy = height / 2;
  const base = Math.min(width, height) * 0.34;
  ctx.clearRect(0, 0, width, height);

  const breathe = state === "listening" ? 1 + 0.05 * Math.sin(t * 1.8) : state === "idle" || state === "paused" ? 1 + 0.015 * Math.sin(t * 0.6) : state === "speaking" ? 1 + 0.03 * energy : 1;
  const r = base * breathe;
  const glow = state === "listening" ? 0.6 : state === "speaking" ? 0.55 + 0.3 * energy : state === "thinking" ? 0.5 : 0.3;

  // Soft glow around the orb.
  const halo = ctx.createRadialGradient(cx, cy, r * 0.8, cx, cy, r * 1.45);
  halo.addColorStop(0, rgba(palette.mid, glow));
  halo.addColorStop(1, rgba(palette.mid, 0));
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, width, height);

  // Listening: a breathing ring.
  if (state === "listening") {
    ctx.strokeStyle = rgba(palette.highlight, 0.28 + 0.12 * Math.sin(t * 1.8));
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, r * (1.14 + 0.05 * Math.sin(t * 1.8)), 0, Math.PI * 2);
    ctx.stroke();
  }

  // The body.
  const body = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.35, r * 0.05, cx, cy, r * 1.05);
  body.addColorStop(0, rgba(palette.highlight, 1));
  body.addColorStop(0.25, rgba(palette.light, 1));
  body.addColorStop(0.5, rgba(palette.mid, 1));
  body.addColorStop(0.8, rgba(palette.deep, 1));
  body.addColorStop(1, rgba(palette.night, 1));
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();

  if (state === "thinking") {
    // Three soft blobs orbit inside the orb: a swirl.
    for (let k = 0; k < 3; k += 1) {
      const a = t * 1.5 + (k * Math.PI * 2) / 3;
      const bx = cx + Math.cos(a) * r * 0.45;
      const by = cy + Math.sin(a) * r * 0.45;
      const blob = ctx.createRadialGradient(bx, by, 0, bx, by, r * 0.7);
      blob.addColorStop(0, rgba(k === 1 ? palette.sky : palette.highlight, 0.6));
      blob.addColorStop(1, rgba(palette.highlight, 0));
      ctx.fillStyle = blob;
      ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    }
  }

  if (state === "speaking") {
    // Waves across the orb, as tall as the speech is loud.
    const amplitude = r * (0.05 + 0.22 * energy);
    for (let k = 0; k < 3; k += 1) {
      ctx.strokeStyle = `rgb(255 255 255 / ${0.8 - k * 0.22})`;
      ctx.lineWidth = 2.5 - k * 0.5;
      ctx.beginPath();
      for (let i = 0; i <= 48; i += 1) {
        const x = cx - r + (i / 48) * r * 2;
        const y = cy + Math.sin((i / 48) * 7 + t * (2.2 + k * 0.8) + k) * amplitude * (1 - k * 0.25);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  }

  // A soft highlight on the upper left, like glass.
  const shine = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.4, 0, cx - r * 0.35, cy - r * 0.4, r * 0.7);
  shine.addColorStop(0, "rgb(255 255 255 / 0.35)");
  shine.addColorStop(1, "rgb(255 255 255 / 0)");
  ctx.fillStyle = shine;
  ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
  ctx.restore();
}

const SWATCHES = [
  ["highlight", "bg-teal-300"],
  ["light", "bg-teal-400"],
  ["mid", "bg-teal-500"],
  ["deep", "bg-blue-700"],
  ["night", "bg-navy-900"],
  ["sky", "bg-sky-400"],
] as const;

type Props = {
  state: OrbState;
  /** A word was spoken: set to 1; the orb eases it back to 0 itself. Kept in a ref so speech never re-renders React. */
  pulse: MutableRefObject<number>;
  className?: string;
};

/**
 * The large glowing orb (Option B panel, Option A orb). A single canvas drawn with requestAnimationFrame: it
 * pauses when the tab is hidden, caps the pixel ratio at 2, and with reduced motion draws one still frame per
 * state instead of animating. The brand colours are read from hidden swatches that use the design-token classes,
 * so no colour value lives here. The canvas is decoration; the state is announced as text by the panel.
 */
export function Orb({ state, pulse, className }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const swatches = useRef<HTMLDivElement>(null);
  const stateRef = useRef(state);
  stateRef.current = state;
  /** Set while the animation effect is mounted: draws one still frame (used for reduced motion). */
  const still = useRef<(() => void) | null>(null);

  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    let ctx: CanvasRenderingContext2D | null = null;
    try {
      ctx = el.getContext("2d");
    } catch {
      ctx = null;
    }
    if (!ctx) return; // no canvas support (for example in a test runner): the state text still tells the story
    const context = ctx;

    const palette: Palette = { highlight: null, light: null, mid: null, deep: null, night: null, sky: null };
    const readPalette = () => {
      const holder = swatches.current;
      if (!holder) return;
      SWATCHES.forEach(([key], index) => {
        const node = holder.children[index];
        if (node) palette[key] = parseRgb(getComputedStyle(node).backgroundColor);
      });
    };
    readPalette();

    const reduce = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let width = 0;
    let height = 0;
    let dpr = 1;
    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = el.clientWidth || 240;
      height = el.clientHeight || 240;
      el.width = Math.round(width * dpr);
      el.height = Math.round(height * dpr);
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();

    let energy = 0;
    let raf = 0;
    const start = performance.now();
    const paint = (now: number) => {
      const speaking = stateRef.current === "speaking";
      // Speech loudness: a floor so the waves are visible, plus a bump for every spoken word that eases away.
      const target = speaking ? Math.min(1, 0.3 + pulse.current) : 0;
      energy += (target - energy) * 0.18;
      pulse.current *= 0.9;
      drawOrb(context, width, height, { time: reduce ? 0 : (now - start) / 1000, state: stateRef.current, energy: reduce ? (speaking ? 0.4 : 0) : energy }, palette);
    };
    const loop = (now: number) => {
      if (!document.hidden) paint(now);
      raf = requestAnimationFrame(loop);
    };
    if (reduce) {
      still.current = () => paint(performance.now());
      paint(performance.now());
    } else {
      raf = requestAnimationFrame(loop);
    }

    const observer = typeof ResizeObserver === "function" ? new ResizeObserver(() => {
      resize();
      if (reduce) paint(performance.now());
    }) : null;
    observer?.observe(el);
    const onTheme = () => {
      readPalette();
      if (reduce) paint(performance.now());
    };
    window.matchMedia?.("(prefers-color-scheme: dark)")?.addEventListener?.("change", onTheme);

    return () => {
      still.current = null;
      cancelAnimationFrame(raf);
      observer?.disconnect();
      window.matchMedia?.("(prefers-color-scheme: dark)")?.removeEventListener?.("change", onTheme);
    };
  }, [pulse]);

  // With reduced motion there is no animation loop, so redraw the still frame whenever the state changes.
  useEffect(() => {
    still.current?.();
  }, [state]);

  return (
    <>
      <canvas ref={canvas} aria-hidden="true" data-testid="voice-orb" data-state={state} className={className ?? "size-48"} />
      <div ref={swatches} aria-hidden="true" className="hidden">
        {SWATCHES.map(([key, cls]) => (
          <i key={key} className={cls} />
        ))}
      </div>
    </>
  );
}
