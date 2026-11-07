// @vitest-environment node
import { describe, expect, it } from "vitest";

import { srcFiles } from "./helpers/src-files";

// Few HTTP call sites means few places for the timeout, the headers and the error mapping: the catalog
// reader and the booking proxy (both server-only), and the browser calls of the booking flow to our own routes.
// The staff app adds exactly two: its server-only backend caller and its browser client (src/admin/lib).
// Feature 010 v1.1 adds one: the assistant's optional AI provider, which calls only this site's /api/assistant
// (off by default).
describe("single fetch call site", () => {
  it("calls fetch( only in the catalog, booking, staff-app and assistant call sites", () => {
    const callers = srcFiles().filter((f) => /(?<![\w.])fetch\s*\(/.test(f.code)).map((f) => f.path);
    expect(callers.sort()).toEqual([
      "admin/lib/client.ts",
      "admin/lib/server.ts",
      "agent/remoteProvider.ts",
      "lib/api/http.ts",
      "lib/booking/backend.ts",
      "lib/booking/client.ts",
    ]);
  });
});
