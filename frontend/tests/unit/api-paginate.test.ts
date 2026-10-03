// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { ApiError } from "@/lib/api/http";
import { getAllPages } from "@/lib/api/paginate";

const Item = z.object({ n: z.number() });

function page(items: number[], total: number, pageNumber: number) {
  return new Response(JSON.stringify({ items: items.map((n) => ({ n })), total, page: pageNumber, pageSize: 100 }), {
    status: 200,
  });
}

function pageOf(url: string) {
  return Number(new URL(url).searchParams.get("page"));
}

beforeEach(() => {
  vi.stubEnv("CATALOG_API_URL", "http://api.test");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("getAllPages", () => {
  it("makes one call when the total fits in one page", async () => {
    const fetchMock = vi.fn(async () => page([1, 2, 3], 3, 1));
    vi.stubGlobal("fetch", fetchMock);
    await expect(getAllPages("/doctors", Item)).resolves.toEqual([{ n: 1 }, { n: 2 }, { n: 3 }]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String((fetchMock.mock.calls[0] as unknown as [string])[0])).toContain("/api/v1/doctors?page=1&pageSize=100");
  });

  it("fetches page 1 first, then pages 2 and 3 concurrently, and concatenates in page order", async () => {
    const events: string[] = [];
    const resolvers = new Map<number, () => void>();
    const fetchMock = vi.fn((url: string) => {
      const p = pageOf(url);
      events.push(`start ${p}`);
      if (p === 1) return Promise.resolve(page([1], 250, 1));
      return new Promise<Response>((resolve) => {
        // Page 3 answers first to prove the order comes from the page number, not arrival.
        resolvers.set(p, () => {
          events.push(`end ${p}`);
          resolve(page([p * 10], 250, p));
        });
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = getAllPages("/doctors", Item);
    await vi.waitFor(() => expect(resolvers.size).toBe(2));
    expect(events).toEqual(["start 1", "start 2", "start 3"]); // both started before either resolved
    resolvers.get(3)?.();
    resolvers.get(2)?.();
    await expect(result).resolves.toEqual([{ n: 1 }, { n: 20 }, { n: 30 }]);
  });

  it("throws when any page fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => (pageOf(url) === 2 ? new Response("{}", { status: 500 }) : page([1], 250, pageOf(url)))),
    );
    await expect(getAllPages("/doctors", Item)).rejects.toMatchObject({ kind: "status", status: 500 });
  });

  it("gives every page call the same AbortSignal", async () => {
    const fetchMock = vi.fn(async (url: string) => page([pageOf(url)], 250, pageOf(url)));
    vi.stubGlobal("fetch", fetchMock);
    await getAllPages("/doctors", Item);
    const signals = fetchMock.mock.calls.map((call) => (call as unknown as [string, RequestInit])[1].signal);
    expect(signals).toHaveLength(3);
    expect(new Set(signals).size).toBe(1);
  });

  it("has one 3 s budget per resource: page 2 hanging after page 1 took 2500 ms times out at 3000 ms total", async () => {
    vi.useFakeTimers();
    vi.spyOn(AbortSignal, "timeout").mockImplementation((ms) => {
      const controller = new AbortController();
      setTimeout(() => controller.abort(new DOMException("timed out", "TimeoutError")), ms);
      return controller.signal;
    });
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string, init?: RequestInit) => {
        if (pageOf(url) === 1) {
          return new Promise<Response>((resolve) => setTimeout(() => resolve(page([1], 250, 1)), 2500));
        }
        return new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => reject(init.signal?.reason));
        });
      }),
    );

    const started = Date.now();
    const outcome = getAllPages("/doctors", Item).then(
      () => null,
      (error: unknown) => ({ error, at: Date.now() - started }),
    );
    await vi.advanceTimersByTimeAsync(3000);
    const result = await outcome;
    expect(result?.error).toBeInstanceOf(ApiError);
    expect((result?.error as ApiError).kind).toBe("timeout");
    expect(result?.at).toBe(3000);
  });
});
