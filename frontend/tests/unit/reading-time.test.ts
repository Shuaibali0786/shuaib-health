import { describe, expect, it } from "vitest";
import { healthTips } from "@/data/healthTips";
import { getHealthTips, getRelatedTips } from "@/lib/content";
import { countWords, readingMinutes } from "@/lib/readingTime";
import type { ArticleBlock } from "@/types/content";

const words = (count: number) => Array.from({ length: count }, () => "word").join(" ");
const body = (count: number): ArticleBlock[] => [{ type: "paragraph", text: words(count) }];

describe("readingMinutes", () => {
  it("is never less than one minute, even for an empty body", () => {
    expect(readingMinutes([])).toBe(1);
    expect(readingMinutes(body(1))).toBe(1);
  });

  it("rounds up at 200 words a minute", () => {
    expect(readingMinutes(body(200))).toBe(1);
    expect(readingMinutes(body(201))).toBe(2);
    expect(readingMinutes(body(400))).toBe(2);
    expect(readingMinutes(body(401))).toBe(3);
  });

  it("counts headings, paragraphs and every list item", () => {
    const blocks: ArticleBlock[] = [
      { type: "heading", text: "Two words" },
      { type: "paragraph", text: "  one   two three " },
      { type: "list", items: ["a b", "c"] },
    ];
    expect(countWords(blocks)).toBe(8);
  });
});

describe("tip accessors", () => {
  it("lists every tip newest first", async () => {
    const tips = await getHealthTips();
    expect(tips).toHaveLength(healthTips.length);
    const times = tips.map((tip) => Date.parse(tip.publishedAt));
    expect(times).toEqual([...times].sort((a, b) => b - a));
  });

  it("gives related articles from the same category first, then the newest, never the article itself", async () => {
    const related = await getRelatedTips("staying-hydrated");
    expect(related).toHaveLength(3);
    expect(related.map((tip) => tip.slug)).not.toContain("staying-hydrated");
    expect(related[0]?.slug).toBe("balanced-plate");
    expect(new Set(related.map((tip) => tip.slug)).size).toBe(3);
  });

  it("respects the limit and returns nothing for a limit of zero", async () => {
    expect(await getRelatedTips("daily-walk", 2)).toHaveLength(2);
    expect(await getRelatedTips("daily-walk", 0)).toEqual([]);
  });
});
