import "server-only";

import type { z } from "zod";

import { getJson } from "./http";
import { pageSchema } from "./schemas";

const PAGE_SIZE = 100;

/**
 * Fetch every page of a list endpoint: page 1 first (it tells us the total), then pages 2..n in
 * parallel. One 3 s deadline covers all pages, so a long list never makes a render wait longer.
 */
export async function getAllPages<T>(path: `/${string}`, item: z.ZodType<T>): Promise<T[]> {
  const signal = AbortSignal.timeout(3000);
  const schema = pageSchema(item);
  const pagePath = (page: number): `/${string}` => `${path}?page=${page}&pageSize=${PAGE_SIZE}`;

  const first = await getJson(pagePath(1), schema, signal);
  const pageCount = Math.ceil(first.total / PAGE_SIZE);
  if (pageCount <= 1) return first.items;

  const rest = await Promise.all(
    Array.from({ length: pageCount - 1 }, (_, i) => getJson(pagePath(i + 2), schema, signal)),
  );
  return [...first.items, ...rest.flatMap((page) => page.items)];
}
