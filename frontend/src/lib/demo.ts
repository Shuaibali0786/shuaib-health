import { parseFreeModels } from "./openrouterModels";

/**
 * DEMO_ENABLED: the portfolio's read-only demo dashboard. On by default; a real clinic deployment sets
 * `DEMO_ENABLED=false` and the gold top bar, the demo buttons (footer, About, sign-in) and the demo entry
 * route all disappear. The backend reads the same name and then answers 404 to the demo and serves no demo
 * data. Read when asked (not at import), so a test or a restart with another value is honoured; the public
 * pages are rendered at build or revalidation time, so set it before building.
 *
 * On Vercel (`VERCEL_ENV` production or preview) the value must be set explicitly: a missing value fails
 * the build instead of silently turning the demo on or off. Local runs and tests keep the default.
 */
export function isDemoEnabled(): boolean {
  const raw = process.env.DEMO_ENABLED?.trim().toLowerCase();
  const vercelEnv = process.env.VERCEL_ENV;
  if (!raw && (vercelEnv === "production" || vercelEnv === "preview")) {
    throw new Error("DEMO_ENABLED must be set explicitly on Vercel (true or false).");
  }
  return !(raw === "false" || raw === "0" || raw === "no" || raw === "off");
}

/**
 * ASSISTANT_ENABLED: the chat assistant (Feature 010, ADR-0013). OFF by default: only "true", "1", "yes" or
 * "on" turn it on. Read when asked; the public pages are rendered at build or revalidation time, so set it
 * before building, like DEMO_ENABLED. When off, no assistant code or data is in any page. It lives in this
 * file because this is the one place the public site reads its feature switches.
 */
export function isAssistantEnabled(): boolean {
  const raw = process.env.ASSISTANT_ENABLED?.trim().toLowerCase();
  return raw === "true" || raw === "1" || raw === "yes" || raw === "on";
}

/**
 * ASSISTANT_PROVIDER (Feature 010 v1.1): which engine answers the chat. "local" (the default, and anything
 * unknown) is the free built-in engine. "claude" adds the optional AI provider for questions the free
 * engine cannot answer; it also needs ASSISTANT_AI_ENABLED and ANTHROPIC_API_KEY on the API, and falls
 * back to the free engine whenever the API says no (off, limits, monthly budget). Read at build time.
 */
export function getAssistantProvider(): "local" | "claude" {
  return process.env.ASSISTANT_PROVIDER?.trim().toLowerCase() === "claude" ? "claude" : "local";
}

/**
 * VOICE_ENABLED (Feature 013, Phase 1): the voice receptionist inside the chat (discovery bubble, Mic and
 * Voice mode buttons). OFF by default and only meaningful when the assistant itself is on. Read at build
 * time, like ASSISTANT_ENABLED. Free browser speech only: no paid service, no audio stored.
 */
export function isVoiceEnabled(): boolean {
  const raw = process.env.VOICE_ENABLED?.trim().toLowerCase();
  return isAssistantEnabled() && (raw === "true" || raw === "1" || raw === "yes" || raw === "on");
}

/**
 * VOICE_PROVIDER (Feature 013): "browser" (the default, free) or "azure" (premium neural voices and listening). Azure
 * also needs AZURE_SPEECH_KEY and AZURE_SPEECH_REGION on the API, which hands out short-lived tokens; whenever it is
 * not available the voice falls back to the browser silently. Read at build time; only meaningful with voice on.
 */
export function getVoiceProvider(): "browser" | "azure" {
  return isVoiceEnabled() && process.env.VOICE_PROVIDER?.trim().toLowerCase() === "azure" ? "azure" : "browser";
}

/**
 * VOICE_BRAIN (Feature 013): "rules" (the default, free, local), "openrouter" (free ":free" models through OpenRouter) or
 * "gemini" (Google Gemini free tier). The AI is used only to UNDERSTAND a turn the rules could not; booking is still done
 * only by our own code after the patient's Confirm. The keys (OPENROUTER_API_KEY, GEMINI_API_KEY) are read on the server
 * only and never reach the browser. Missing key = rules, silently.
 */
export function getVoiceBrain(): "rules" | "gemini" | "openrouter" {
  if (!isVoiceEnabled()) return "rules";
  const value = process.env.VOICE_BRAIN?.trim().toLowerCase();
  return value === "gemini" || value === "openrouter" ? value : "rules";
}

/**
 * Server only: the OpenRouter key and the free models to try in order (OPENROUTER_MODEL, comma separated, ids ending in
 * ":free" only; a built-in list of good free tool-calling models when none is set), or null when this brain is off or
 * has no key (then the rules answer).
 */
export function getOpenRouterSettings(): { key: string; models: string[] } | null {
  const key = process.env.OPENROUTER_API_KEY?.trim();
  if (getVoiceBrain() !== "openrouter" || !key) return null;
  return { key, models: parseFreeModels(process.env.OPENROUTER_MODEL) };
}

/** Server only: the Gemini key and model, or null when the AI brain is off or has no key (then the rules answer). */
export function getGeminiSettings(): { key: string; model: string } | null {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (getVoiceBrain() !== "gemini" || !key) return null;
  const model = (process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash").replace(/[^a-z0-9.-]/gi, "");
  return { key, model };
}
