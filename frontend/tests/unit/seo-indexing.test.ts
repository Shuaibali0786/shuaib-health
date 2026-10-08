import { afterEach, describe, expect, it, vi } from "vitest";
import nextConfig from "../../next.config";
import { siteConfig } from "../fixtures/catalog/siteConfig";

// The `indexable` flag of each clinic is the only switch for search engines. The fictional demo clinic keeps it
// false (honesty); a real clinic sets it true. Staff pages are noindex whatever the flag says.

vi.mock("next/font/google", () => ({
  Inter: () => ({ variable: "inter", className: "inter" }),
  Plus_Jakarta_Sans: () => ({ variable: "jakarta", className: "jakarta" }),
  Cormorant_Garamond: () => ({ variable: "cormorant", className: "cormorant" }),
}));

async function siteRobots(indexable: boolean) {
  vi.resetModules();
  vi.doMock("@/lib/content", () => ({ getSiteConfig: async () => ({ ...siteConfig, indexable }) }));
  const { generateMetadata } = await import("@/app/(site)/layout");
  return (await generateMetadata()).robots;
}

afterEach(() => {
  vi.doUnmock("@/lib/content");
  vi.resetModules();
});

describe("public pages follow the clinic's indexable flag", () => {
  it("are noindex for the demo clinic (indexable false)", async () => {
    expect(await siteRobots(false)).toEqual({ index: false, follow: false });
  });

  it("are index, follow for a real clinic (indexable true)", async () => {
    expect(await siteRobots(true)).toEqual({ index: true, follow: true });
  });
});

describe("staff pages stay private", () => {
  it("send noindex metadata from their own root layout", async () => {
    const { metadata } = await import("@/app/(admin)/admin/layout");
    expect(metadata.robots).toEqual({ index: false, follow: false });
  });

  it("get the private headers only on /admin and /api/admin paths, never on a public path", async () => {
    const rules = await nextConfig.headers!();
    const privateRules = rules.filter((rule) =>
      rule.headers.some((header) => header.key.toLowerCase() === "x-robots-tag" || /no-store/.test(header.value)),
    );
    expect(privateRules.map((rule) => rule.source).sort()).toEqual(["/admin", "/admin/:path*", "/api/admin/:path*"]);
    for (const rule of rules) expect(rule.source, rule.source).toMatch(/^\/(api\/)?admin(\/|$)/);
  });
});
