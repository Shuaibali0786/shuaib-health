// @vitest-environment node
import { describe, expect, it } from "vitest";

import { scanClientBundles } from "./helpers/client-bundle-scan";

// SC-006: the API address, the server-only settings and the booking proxy secret never appear in browser bundles.
describe("client bundles", () => {
  const { scanned, hits } = scanClientBundles();

  it.skipIf(scanned.length === 0)("contain no API URL or server-only variable name", () => {
    expect(hits).toEqual([]);
  });

  it("report which builds were scanned", () => {
    if (scanned.length === 0) console.info("no-api-url-in-client: no production build found, nothing to scan");
    expect(Array.isArray(scanned)).toBe(true);
  });
});
