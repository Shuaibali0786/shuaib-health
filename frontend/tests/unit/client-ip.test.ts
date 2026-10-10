// @vitest-environment node
import { describe, expect, it } from "vitest";

import { clientIpFrom } from "@/lib/booking/backend";

describe("clientIpFrom preference order", () => {
  it("prefers x-vercel-forwarded-for over x-real-ip and x-forwarded-for", () => {
    const headers = new Headers({
      "x-vercel-forwarded-for": "203.0.113.1",
      "x-real-ip": "203.0.113.2",
      "x-forwarded-for": "203.0.113.3",
    });
    expect(clientIpFrom(headers)).toBe("203.0.113.1");
  });

  it("then x-real-ip over x-forwarded-for", () => {
    const headers = new Headers({ "x-real-ip": "203.0.113.2", "x-forwarded-for": "203.0.113.3" });
    expect(clientIpFrom(headers)).toBe("203.0.113.2");
  });

  it("then the first valid x-forwarded-for entry", () => {
    expect(clientIpFrom(new Headers({ "x-forwarded-for": "junk, 203.0.113.3, 10.0.0.1" }))).toBe("203.0.113.3");
  });

  it("skips an invalid preferred header and falls through", () => {
    const headers = new Headers({ "x-vercel-forwarded-for": "not-an-ip", "x-real-ip": "203.0.113.2" });
    expect(clientIpFrom(headers)).toBe("203.0.113.2");
  });

  it("is unknown when nothing parses", () => {
    expect(clientIpFrom(new Headers({ "x-forwarded-for": "999.1.1.1" }))).toBe("unknown");
  });
});
