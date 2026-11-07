// Feature 010 v1.1: the optional AI provider (OFF by default). The free engine answers first; only an
// unknown question reaches /api/assistant, and any failure falls back to the free answer.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { buildKnowledgePack } from "@/agent/knowledge";
import { getProvider } from "@/agent/registry";
import { getAssistantProvider } from "@/lib/demo";
import { faqGroups } from "@/data/faq";

import { departments } from "../fixtures/catalog/departments";
import { doctors } from "../fixtures/catalog/doctors";
import { healthPackages } from "../fixtures/catalog/healthPackages";
import { labTests } from "../fixtures/catalog/labTests";
import { siteConfig } from "../fixtures/catalog/siteConfig";

const pack = buildKnowledgePack({ site: siteConfig, departments, doctors, labTests, packages: healthPackages, faqGroups, demo: true });
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("ASSISTANT_PROVIDER", () => {
  it("is the free local engine unless set to claude", () => {
    vi.stubEnv("ASSISTANT_PROVIDER", "");
    expect(getAssistantProvider()).toBe("local");
    vi.stubEnv("ASSISTANT_PROVIDER", "openai");
    expect(getAssistantProvider()).toBe("local");
    vi.stubEnv("ASSISTANT_PROVIDER", " Claude ");
    expect(getAssistantProvider()).toBe("claude");
  });
});

describe("claude provider (hybrid)", () => {
  const provider = getProvider(pack, "claude");

  it("answers greetings, emergencies, symptoms and known topics with the free engine, without any network call", async () => {
    for (const question of ["hi", "chest pain emergency", "tooth pain", "When are you open?", "cbc price"]) {
      expect((await provider.answer({ mode: "patient", question })).intent).not.toBe("ai");
    }
    expect((await provider.answer({ mode: "guide", question: "something odd" })).intent).toBe("guide_unknown");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends only an unknown question to the site's own route and shows the AI answer", async () => {
    fetchMock.mockResolvedValueOnce(json({ text: "Parking is available next to the clinic." }));
    const reply = await provider.answer({ mode: "patient", question: "is there parking nearby" });
    expect(reply).toMatchObject({ intent: "ai", text: "Parking is available next to the clinic." });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/assistant");
    expect(JSON.parse(init.body as string)).toEqual({ question: "is there parking nearby" });
  });

  it("falls back to the free engine's friendly answer when the route says no or the network fails", async () => {
    fetchMock.mockResolvedValueOnce(json({ error: { code: "service_unavailable" } }, 503));
    const busy = await provider.answer({ mode: "patient", question: "is there parking nearby" });
    expect(busy.intent).toBe("unknown");
    expect(busy.text).not.toMatch(/^sorry/i);
    fetchMock.mockRejectedValueOnce(new TypeError("offline"));
    expect((await provider.answer({ mode: "patient", question: "is there parking nearby" })).intent).toBe("unknown");
  });
});
