// @vitest-environment node
import { describe, expect, it } from "vitest";

import { maskText, scrubEvent } from "@/lib/sentry-scrub";

const PHONE = "0300 1234567";
const EMAIL = "fake.patient@example.org";
const REFERENCE = "ABCDE-FGHJK";

function dirtyEvent() {
  return {
    message: `${EMAIL} rang ${PHONE} about ${REFERENCE}`,
    user: { email: EMAIL, ip_address: "203.0.113.9" },
    server_name: "somebody-laptop",
    request: {
      url: `https://site.example.org/book-appointment/${REFERENCE}?phone=${PHONE}`,
      query_string: `phone=${PHONE}&email=${EMAIL}`,
      cookies: { admin_session: "secret-cookie" },
      data: { name: "Ali Khan", mobile: PHONE },
      headers: {
        "User-Agent": "curl/8",
        Cookie: "admin_session=secret-cookie",
        Authorization: "Bearer abc",
        "X-Proxy-Secret": "proxy-secret-value",
        "X-Session-Token": "tok",
        "X-Forwarded-For": "203.0.113.9",
        "X-Vercel-Protection-Bypass": "bypass",
        "X-Test-Phone": PHONE,
      },
    },
    exception: { values: [{ type: "Error", value: `failed for ${EMAIL}` }] },
    breadcrumbs: [{ message: `GET /lookup?ref=${REFERENCE}` }],
  };
}

describe("scrubEvent", () => {
  it("drops identity, credentials, query strings and bodies", () => {
    const clean = scrubEvent(dirtyEvent()) as ReturnType<typeof dirtyEvent> & Record<string, unknown>;
    expect(clean.user).toBeUndefined();
    expect(clean.server_name).toBeUndefined();
    const request = clean.request as Record<string, unknown>;
    for (const dropped of ["cookies", "data", "query_string"]) expect(request[dropped]).toBeUndefined();
    expect(request.url).toBe("https://site.example.org/book-appointment/[reference]");
    expect(Object.keys(request.headers as object).sort()).toEqual(["User-Agent", "X-Test-Phone"]);
  });

  it("masks phone, email and booking reference in every string", () => {
    const text = JSON.stringify(scrubEvent(dirtyEvent()));
    for (const leaked of [PHONE, "1234567", EMAIL, REFERENCE, "FGHJK", "secret-cookie", "Ali Khan"]) {
      expect(text).not.toContain(leaked);
    }
    for (const marker of ["[email]", "[phone]", "[reference]"]) expect(text).toContain(marker);
  });

  it("does not change the event it is given", () => {
    const event = dirtyEvent();
    scrubEvent(event);
    expect(event.user.email).toBe(EMAIL);
  });
});

describe("maskText", () => {
  it.each([
    ["call +92 300 1234567 now", "call [phone] now"],
    ["03001234567", "[phone]"],
    ["a.b+c@mail.example.com", "[email]"],
    ["ref abcde-fghjk and ABCDEFGHJK", "ref [reference] and [reference]"],
    ["status 503 after 12 retries", "status 503 after 12 retries"],
  ])("%s", (raw, masked) => {
    expect(maskText(raw)).toBe(masked);
  });
});
