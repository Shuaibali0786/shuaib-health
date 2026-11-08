// Feature 013: the optional Gemini brain (VOICE_BRAIN=gemini, OFF by default). A fake fetch stands in for Google: no
// real call, no key. It only ever chooses from our catalog, never books, and every failure falls back silently.
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { askGemini, validInCatalog } from "@/lib/voiceBrainGemini";
import type { Brain } from "@/voice/brain";

import { makeWorld, packFor } from "../voice/harness";

const pack = packFor(false);
const reply = (name: string, args: Record<string, unknown>) =>
  Promise.resolve(new Response(JSON.stringify({ candidates: [{ content: { parts: [{ functionCall: { name, args } }] } }] }), { status: 200 }));

describe("askGemini (server)", () => {
  it("is off without a key: no request at all", async () => {
    const fetcher = vi.fn();
    expect(await askGemini("neend nahi aati", "roman", pack, null, fetcher as never)).toBeNull();
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("sends the key in a header (never in the URL) with our catalog as tools, and returns a valid choice", async () => {
    const fetcher = vi.fn<(url: string, init: RequestInit) => Promise<Response>>(() => reply("suggest_department", { slug: "general-medicine" }));
    const out = await askGemini("neend nahi aati", "roman", pack, { key: "test-key", model: "gemini-2.5-flash" }, fetcher as never);
    expect(out).toEqual({ action: "suggest_department", slug: "general-medicine" });
    const [url, init] = fetcher.mock.calls[0] as [string, RequestInit];
    expect(url).not.toContain("test-key");
    expect((init.headers as Record<string, string>)["x-goog-api-key"]).toBe("test-key");
    const body = JSON.parse(String(init.body)) as { tools: Array<{ functionDeclarations: Array<{ name: string; parameters: { properties: { slug?: { enum: string[] } } } }> }> };
    const names = body.tools[0]?.functionDeclarations.map((f) => f.name);
    expect(names).toEqual(["suggest_department", "offer_lab_test", "offer_package", "clinic_answer", "ask_problem"]);
    expect(names).not.toContain("book");
    expect(body.tools[0]?.functionDeclarations[0]?.parameters.properties.slug?.enum).toContain("dermatology");
  });

  it.each([
    ["an invented department", "suggest_department", { slug: "neurology" }],
    ["an invented test", "offer_lab_test", { slug: "mri-brain" }],
    ["an answer in Urdu letters", "clinic_answer", { text: "کلینک کھلا ہے" }],
    ["an answer with a link", "clinic_answer", { text: "See https://example.com" }],
    ["an unknown tool", "book_appointment", { slug: "dental" }],
  ])("rejects %s", async (_label, name, args) => {
    const fetcher = vi.fn(() => reply(name, args));
    expect(await askGemini("x", "en", pack, { key: "k", model: "gemini-2.5-flash" }, fetcher as never)).toBeNull();
  });

  it("falls back silently on an error, a limit or a timeout", async () => {
    const env = { key: "k", model: "gemini-2.5-flash" };
    expect(await askGemini("x", "en", pack, env, (() => Promise.resolve(new Response("{}", { status: 429 }))) as never)).toBeNull();
    expect(await askGemini("x", "en", pack, env, (() => Promise.reject(new Error("timeout"))) as never)).toBeNull();
  });

  it("validInCatalog accepts only what we have", () => {
    expect(validInCatalog({ action: "offer_package", slug: "basic-health-check" }, pack)).toBe(true);
    expect(validInCatalog({ action: "offer_package", slug: "gold-package" }, pack)).toBe(false);
  });
});

describe("the brain inside a conversation", () => {
  const withBrain = (brain: Brain) => {
    const w = makeWorld();
    w.ctx.brain = brain;
    return w;
  };

  it("is asked ONLY when the rules did not understand", async () => {
    const brain = vi.fn<Brain>(async () => ({ action: "suggest_department", slug: "general-medicine" }));
    const w = withBrain(brain);
    await w.say("mujhe bukhar hai");
    await w.say("What are your timings?");
    expect(brain).not.toHaveBeenCalled();
    const out = await w.say("mujhe raat ko neend nahi aati");
    expect(brain).toHaveBeenCalledTimes(1);
    expect(out.text).toContain("General Medicine");
  });

  it("never books: its offer still needs the patient's yes, the card and a Confirm", async () => {
    const w = withBrain(async () => ({ action: "offer_package", slug: "senior-citizen" }));
    const out = await w.say("abbu ke liye kuch chahiye");
    expect(out.text).toContain("Senior Citizen");
    expect(w.submits).toHaveLength(0);
    expect(w.ctx.booking).toBeNull();
  });

  it("a brain that fails or invents a slug leaves the rules' own reply", async () => {
    const failing = withBrain(async () => null);
    expect((await failing.say("blah blah xyz")).text).toMatch(/takleef|problem|madad|help/i);
    const inventing = withBrain(async () => ({ action: "suggest_department", slug: "neurology" }));
    expect((await inventing.say("blah blah xyz")).text).not.toContain("neurology");
  });

  it("the safety guards still run first (an emergency never reaches the brain)", async () => {
    const brain = vi.fn<Brain>(async () => ({ action: "ask_problem" }));
    const w = withBrain(brain);
    const out = await w.say("seene mein dard hai saans nahi aa rahi");
    expect(out.text).toContain("1122");
    expect(brain).not.toHaveBeenCalled();
  });
});
