// @vitest-environment node
import { describe, expect, it } from "vitest";

import { srcFiles } from "./helpers/src-files";

// Few HTTP call sites means few places for the timeout, the headers and the error mapping: the catalog
// reader and the booking proxy (both server-only), and the browser calls of the booking flow to our own routes.
describe("single fetch call site", () => {
  it("calls fetch( only in src/lib/api/http.ts, src/lib/booking/backend.ts and src/lib/booking/client.ts", () => {
    const callers = srcFiles().filter((f) => /(?<![\w.])fetch\s*\(/.test(f.code)).map((f) => f.path);
    expect(callers).toEqual(["lib/api/http.ts", "lib/booking/backend.ts", "lib/booking/client.ts"]);
  });
});
