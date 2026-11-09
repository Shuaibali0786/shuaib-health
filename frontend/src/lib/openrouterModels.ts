// Which OpenRouter models the AI brain may use (Feature 013). FREE MODELS ONLY: an id must end in ":free".

/** Good free models with tool calling, checked against OpenRouter's public model list (2026-11-09). */
export const DEFAULT_OPENROUTER_MODELS = ["google/gemma-4-31b-it:free", "google/gemma-4-26b-a4b-it:free", "nvidia/nemotron-3.5-lightning:free"];

/** The configured model ids (comma separated), free ones only, at most three; the defaults when none is usable. */
export function parseFreeModels(raw: string | undefined): string[] {
  const wanted = (raw ?? "")
    .split(",")
    .map((m) => m.trim())
    .filter((m) => /^[a-z0-9][a-z0-9._/-]*:free$/i.test(m));
  return (wanted.length ? wanted : DEFAULT_OPENROUTER_MODELS).slice(0, 3);
}
