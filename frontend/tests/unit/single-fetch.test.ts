// @vitest-environment node
import { describe, expect, it } from "vitest";

import { srcFiles } from "./helpers/src-files";

// One HTTP call site means one place for the timeout, the headers and the error mapping.
describe("single fetch call site", () => {
  it("calls fetch( only in src/lib/api/http.ts", () => {
    const callers = srcFiles().filter((f) => /(?<![\w.])fetch\s*\(/.test(f.code)).map((f) => f.path);
    expect(callers).toEqual(["lib/api/http.ts"]);
  });
});
