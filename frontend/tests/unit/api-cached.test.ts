// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Recorded = { key: string[]; opts: { revalidate: number; tags: string[] } };
const recorded: Recorded[] = [];

/**
 * Simulates the Next data-cache semantics we rely on (ADR-0004): no entry -> run and store on
 * success, rethrow on failure; entry present -> run, store on success, return the stale value on failure.
 */
vi.mock("next/cache", () => ({
  unstable_cache: (fn: () => Promise<unknown>, key: string[], opts: Recorded["opts"]) => {
    recorded.push({ key, opts });
    let entry: { value: unknown } | undefined;
    return async () => {
      try {
        const value = await fn();
        entry = { value };
        return value;
      } catch (error) {
        if (entry) return entry.value;
        throw error;
      }
    };
  },
}));

const getJson = vi.fn();
const getAllPages = vi.fn();
vi.mock("@/lib/api/http", () => ({ getJson: (...args: unknown[]) => getJson(...args) }));
vi.mock("@/lib/api/paginate", () => ({ getAllPages: (...args: unknown[]) => getAllPages(...args) }));

const RESOURCES = [
  ["cachedClinic", "clinic"],
  ["cachedClinicRules", "clinic-rules"],
  ["cachedDepartments", "departments"],
  ["cachedDoctors", "doctors"],
  ["cachedLabTestCategories", "lab-test-categories"],
  ["cachedLabTests", "lab-tests"],
  ["cachedHealthPackages", "health-packages"],
] as const;

async function importCached() {
  recorded.length = 0;
  vi.resetModules();
  return import("@/lib/api/cached");
}

beforeEach(() => {
  getJson.mockReset();
  getAllPages.mockReset();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("cached loaders", () => {
  it("uses key [api, resource], revalidate 300 and tags [catalog, resource] by default", async () => {
    vi.stubEnv("CATALOG_DATA_REVALIDATE_SECONDS", "");
    await importCached();
    expect(recorded.map((r) => r.key[1]).sort()).toEqual(RESOURCES.map(([, key]) => key).sort());
    for (const [, key] of RESOURCES) {
      const entry = recorded.find((r) => r.key[1] === key);
      expect(entry?.key).toEqual(["api", key]);
      expect(entry?.opts).toEqual({ revalidate: 300, tags: ["catalog", key] });
    }
  });

  it("uses revalidate 3 when CATALOG_DATA_REVALIDATE_SECONDS is 3", async () => {
    vi.stubEnv("CATALOG_DATA_REVALIDATE_SECONDS", "3");
    await importCached();
    expect(recorded).toHaveLength(7);
    expect(recorded.every((r) => r.opts.revalidate === 3)).toBe(true);
  });

  it("exports the documentation constant 300", async () => {
    expect((await importCached()).CATALOG_REVALIDATE).toBe(300);
  });

  it("returns the last good value when a later refresh fails", async () => {
    const { cachedDoctors } = await importCached();
    getAllPages.mockResolvedValueOnce([{ slug: "first" }]);
    await expect(cachedDoctors()).resolves.toEqual([{ slug: "first" }]);
    getAllPages.mockRejectedValueOnce(new Error("down"));
    await expect(cachedDoctors()).resolves.toEqual([{ slug: "first" }]);
    getAllPages.mockRejectedValueOnce(new Error("down again"));
    await expect(cachedDoctors()).resolves.toEqual([{ slug: "first" }]);
  });

  it("replaces the last good value when a refresh succeeds again (recovery)", async () => {
    const { cachedDoctors } = await importCached();
    getAllPages.mockResolvedValueOnce([{ slug: "old" }]);
    await cachedDoctors();
    getAllPages.mockRejectedValueOnce(new Error("down"));
    await expect(cachedDoctors()).resolves.toEqual([{ slug: "old" }]);
    getAllPages.mockResolvedValueOnce([{ slug: "new" }]);
    await expect(cachedDoctors()).resolves.toEqual([{ slug: "new" }]);
    getAllPages.mockRejectedValueOnce(new Error("down"));
    await expect(cachedDoctors()).resolves.toEqual([{ slug: "new" }]);
  });

  it("throws when nothing ever loaded", async () => {
    const { cachedClinic, cachedLabTests } = await importCached();
    getJson.mockRejectedValue(new Error("never up"));
    getAllPages.mockRejectedValue(new Error("never up"));
    await expect(cachedClinic()).rejects.toThrow("never up");
    await expect(cachedLabTests()).rejects.toThrow("never up");
  });

  it("loads the clinic with getJson and lists with getAllPages", async () => {
    const { cachedClinic, cachedClinicRules, cachedHealthPackages } = await importCached();
    getJson.mockResolvedValue({ name: "Clinic" });
    getAllPages.mockResolvedValue([]);
    await cachedClinic();
    await cachedClinicRules();
    await cachedHealthPackages();
    expect(getJson.mock.calls[0]?.[0]).toBe("/clinic");
    expect(getAllPages.mock.calls.map((c) => c[0])).toEqual(["/clinic/rules", "/health-packages"]);
  });
});
