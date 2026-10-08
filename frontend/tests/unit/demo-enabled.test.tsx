// @vitest-environment node
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "@/app/(admin)/admin/demo/start/route";
import { DemoDashboardButton } from "@/components/demo/DemoDashboardButton";
import { AnnouncementBar } from "@/components/layout/AnnouncementBar";
import { isDemoEnabled } from "@/lib/demo";

// DEMO_ENABLED (spec 006): on for the portfolio, off for a real clinic deployment.

const SITE = "http://site.test";
const demoPost = () => new Request(`${SITE}/admin/demo/start`, { method: "POST", headers: { origin: SITE } });

beforeEach(() => {
  vi.stubEnv("CATALOG_API_URL", "http://api.test");
  vi.stubEnv("BOOKING_PROXY_SECRET", "fake-unit-test-proxy-secret-0123456789");
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("isDemoEnabled", () => {
  it("is on when the variable is not set", () => {
    vi.stubEnv("DEMO_ENABLED", "");
    expect(isDemoEnabled()).toBe(true);
  });
  it.each(["true", "1", "yes", "TRUE"])("is on for %s", (value) => {
    vi.stubEnv("DEMO_ENABLED", value);
    expect(isDemoEnabled()).toBe(true);
  });
  it.each(["false", "0", "no", "off", "FALSE", " false "])("is off for %s", (value) => {
    vi.stubEnv("DEMO_ENABLED", value);
    expect(isDemoEnabled()).toBe(false);
  });
});

describe("DEMO_ENABLED on", () => {
  beforeEach(() => vi.stubEnv("DEMO_ENABLED", "true"));

  it("renders the gold top bar with the demo button", () => {
    const html = renderToStaticMarkup(<AnnouncementBar />);
    expect(html).toContain('data-testid="announcement-bar"');
    expect(html).toContain('action="/admin/demo/start"');
  });

  it("renders the demo button", () => {
    expect(renderToStaticMarkup(<DemoDashboardButton className="x" />)).toContain("View Demo Dashboard");
  });

  it("forwards the demo entry to the backend", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ token: "cd_x", viewer: { kind: "demo", csrfToken: "c", clinicToday: "2026-10-05", timezone: "Asia/Karachi" } }), { status: 200, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);
    const response = await POST(demoPost());
    expect(response.status).toBe(303);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("DEMO_ENABLED off", () => {
  beforeEach(() => vi.stubEnv("DEMO_ENABLED", "false"));

  it("renders no top bar", () => {
    expect(renderToStaticMarkup(<AnnouncementBar />)).toBe("");
  });

  it("renders no demo button, wherever it is placed", () => {
    expect(renderToStaticMarkup(<DemoDashboardButton className="x" />)).toBe("");
    expect(renderToStaticMarkup(<DemoDashboardButton className="x">Start a fresh demo</DemoDashboardButton>)).toBe("");
  });

  it("answers 404 to the demo entry and never calls the backend", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const response = await POST(demoPost());
    expect(response.status).toBe(404);
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
