// Feature 013: the OpenRouter AI brain (VOICE_BRAIN=openrouter). A fake fetch stands in for OpenRouter: no real call, no
// key. Free ":free" models only, only our catalog, never books, and every failure falls back silently.
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { getOpenRouterSettings, getVoiceBrain } from "@/lib/demo";
import { DEFAULT_OPENROUTER_MODELS, parseFreeModels } from "@/lib/openrouterModels";
import { askOpenRouter } from "@/lib/voiceBrainOpenRouter";

import { packFor } from "../voice/harness";

const pack = packFor(false);
const call = (name: string, args: Record<string, unknown>) =>
  new Response(JSON.stringify({ choices: [{ message: { tool_calls: [{ function: { name, arguments: JSON.stringify(args) } }] } }] }), { status: 200 });
const error = (status: number, message: string) => new Response(JSON.stringify({ error: { code: status, message } }), { status });
const settings = { key: "sk-or-v1-SECRETKEY", models: ["google/gemma-4-31b-it:free", "google/gemma-4-26b-a4b-it:free"] };

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("which models may be used", () => {
  it("only ids ending in :free, at most three; the defaults when none is usable", () => {
    expect(parseFreeModels("openai/gpt-4o, google/gemma-4-31b-it:free ,anthropic/claude:paid,nvidia/nemotron-3.5-lightning:free")).toEqual(["google/gemma-4-31b-it:free", "nvidia/nemotron-3.5-lightning:free"]);
    expect(parseFreeModels("openai/gpt-4o")).toEqual(DEFAULT_OPENROUTER_MODELS);
    expect(parseFreeModels(undefined)).toEqual(DEFAULT_OPENROUTER_MODELS);
    expect(parseFreeModels("a/b:free,c/d:free,e/f:free,g/h:free")).toHaveLength(3);
    expect(DEFAULT_OPENROUTER_MODELS.every((m) => m.endsWith(":free"))).toBe(true);
  });

  it("is on only with VOICE_ENABLED, VOICE_BRAIN=openrouter and a key", () => {
    vi.stubEnv("ASSISTANT_ENABLED", "true");
    vi.stubEnv("VOICE_ENABLED", "true");
    vi.stubEnv("VOICE_BRAIN", "openrouter");
    vi.stubEnv("OPENROUTER_API_KEY", "");
    expect(getOpenRouterSettings()).toBeNull();
    vi.stubEnv("OPENROUTER_API_KEY", "sk-or-v1-x");
    vi.stubEnv("OPENROUTER_MODEL", "openai/gpt-4o,google/gemma-4-31b-it:free");
    expect(getVoiceBrain()).toBe("openrouter");
    expect(getOpenRouterSettings()).toEqual({ key: "sk-or-v1-x", models: ["google/gemma-4-31b-it:free"] });
    vi.stubEnv("VOICE_BRAIN", "gemini");
    expect(getOpenRouterSettings()).toBeNull();
    vi.stubEnv("VOICE_BRAIN", "openrouter");
    vi.stubEnv("VOICE_ENABLED", "false");
    expect(getOpenRouterSettings()).toBeNull();
  });
});

describe("askOpenRouter (server)", () => {
  it("is off without a key: no request at all", async () => {
    const fetcher = vi.fn();
    expect(await askOpenRouter("neend nahi aati", "roman", pack, null, fetcher as never)).toBeNull();
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("sends the key in a header with our catalog as tools, a zero price ceiling, and returns a valid choice", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const fetcher = vi.fn<(url: string, init: RequestInit) => Promise<Response>>(() => Promise.resolve(call("suggest_department", { slug: "general-medicine" })));
    const out = await askOpenRouter("neend nahi aati", "roman", pack, settings, fetcher as never);
    expect(out).toEqual({ action: "suggest_department", slug: "general-medicine" });
    const [url, init] = fetcher.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://openrouter.ai/api/v1/chat/completions");
    expect((init.headers as Record<string, string>).authorization).toBe("Bearer sk-or-v1-SECRETKEY");
    const body = JSON.parse(String(init.body)) as { model: string; tools: Array<{ type: string; function: { name: string; parameters: { type: string; properties: { slug?: { type: string; enum: string[] } } } } }>; provider: unknown; tool_choice: string };
    expect(body.model).toBe("google/gemma-4-31b-it:free");
    expect(body.provider).toEqual({ max_price: { prompt: 0, completion: 0 }, require_parameters: true });
    expect(body.tool_choice).toBe("required");
    expect(body.tools.map((t) => t.function.name)).toEqual(["suggest_department", "offer_lab_test", "offer_package", "clinic_answer", "ask_problem"]);
    expect(body.tools[0]?.type).toBe("function");
    expect(body.tools[0]?.function.parameters.type).toBe("object");
    expect(body.tools[0]?.function.parameters.properties.slug?.type).toBe("string");
    expect(body.tools[0]?.function.parameters.properties.slug?.enum).toContain("dermatology");
    expect(warn.mock.calls.map((c) => String(c[0])).join("\n")).toContain("google/gemma-4-31b-it:free answered");
  });

  it("never sends a paid model, even if one is passed in", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const fetcher = vi.fn(() => Promise.resolve(call("ask_problem", {})));
    await askOpenRouter("x", "en", pack, { key: "k", models: ["openai/gpt-4o", "google/gemma-4-31b-it:free"] }, fetcher as never);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(JSON.parse(String((fetcher.mock.calls[0] as unknown as [string, RequestInit])[1].body)).model).toBe("google/gemma-4-31b-it:free");
    expect(await askOpenRouter("x", "en", pack, { key: "k", models: ["openai/gpt-4o"] }, fetcher as never)).toBeNull();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("a 429 or an error on the first model tries the next free model; each failure logs status and reason only", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const fetcher = vi.fn((_url: string, init: RequestInit) => Promise.resolve(JSON.parse(String(init.body)).model === "google/gemma-4-31b-it:free" ? error(429, "rate limited SECRET sk-or-v1-SECRETKEY") : call("offer_lab_test", { slug: "complete-blood-count" })));
    const out = await askOpenRouter("khoon ka test", "roman", pack, settings, fetcher as never);
    expect(out).toEqual({ action: "offer_lab_test", slug: "complete-blood-count" });
    expect(fetcher).toHaveBeenCalledTimes(2);
    const logged = warn.mock.calls.map((c) => String(c[0])).join("\n");
    expect(logged).toContain("google/gemma-4-31b-it:free failed: HTTP 429");
    expect(logged).toContain("[key]");
    expect(logged).not.toContain("SECRETKEY");
    expect(logged).not.toContain("khoon");
    expect(logged).toContain("google/gemma-4-26b-a4b-it:free answered");
  });

  it("falls back silently (null) when every model fails, times out or answers nonsense", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    expect(await askOpenRouter("x", "en", pack, settings, (() => Promise.resolve(error(429, "no"))) as never)).toBeNull();
    expect(await askOpenRouter("x", "en", pack, settings, (() => Promise.reject(new Error("timeout"))) as never)).toBeNull();
    expect(await askOpenRouter("x", "en", pack, settings, (() => Promise.resolve(new Response("{}", { status: 200 }))) as never)).toBeNull();
  });

  it.each([
    ["an invented department", "suggest_department", { slug: "neurology" }],
    ["an invented test", "offer_lab_test", { slug: "mri-brain" }],
    ["an answer in Urdu letters", "clinic_answer", { text: "کلینک کھلا ہے" }],
    ["an answer with a link", "clinic_answer", { text: "See https://example.com" }],
    ["a booking tool", "book_appointment", { slug: "dental" }],
  ])("rejects %s", async (_label, name, args) => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const fetcher = vi.fn(() => Promise.resolve(call(name, args)));
    expect(await askOpenRouter("x", "en", pack, { key: "k", models: ["google/gemma-4-31b-it:free"] }, fetcher as never)).toBeNull();
  });
});
