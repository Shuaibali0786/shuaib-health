import type { ArticleBlock } from "@/types/content";

const WORDS_PER_MINUTE = 200;

/** All the text of a set of blocks: headings, paragraphs and list items. */
function blockTexts(blocks: ArticleBlock[]): string[] {
  return blocks.flatMap((block) => (block.type === "list" ? block.items : [block.text]));
}

/** Words in an article body, counting headings, paragraphs and list items. */
export function countWords(blocks: ArticleBlock[]): number {
  return blockTexts(blocks).reduce((total, text) => total + (text.trim() === "" ? 0 : text.trim().split(/\s+/).length), 0);
}

/** Whole minutes to read at 200 words a minute, never less than 1. */
export function readingMinutes(blocks: ArticleBlock[]): number {
  return Math.max(1, Math.ceil(countWords(blocks) / WORDS_PER_MINUTE));
}
