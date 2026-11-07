import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

// The site's CSP has no 'unsafe-eval'. Zod's eval probe (`new Function("")`) is skipped only when
// jitless is set, so every module that validates forms in the browser must set it (live CSP check 2026-11-07).
describe("zod runs without eval on the public forms", () => {
  it("the contact schema turns on jitless", async () => {
    await import("@/lib/contactSchema");
    expect(z.config().jitless).toBe(true);
  });

  it("the booking form turns on jitless", async () => {
    await import("@/lib/booking/form");
    expect(z.config().jitless).toBe(true);
  });

  it.each(["@/admin/lib/client", "@/admin/lib/schemas"])("the staff app module %s turns on jitless", async (path) => {
    vi.resetModules();
    z.config({ jitless: false });
    await import(path);
    expect(z.config().jitless).toBe(true);
  });
});
