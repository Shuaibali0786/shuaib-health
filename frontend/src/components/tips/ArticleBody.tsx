import type { ArticleBlock } from "@/types/content";

/**
 * Renders article blocks as h2 / p / ul. Text is rendered as text, never as HTML, so a block
 * can never inject markup.
 */
export function ArticleBody({ blocks }: { blocks: ArticleBlock[] }) {
  return (
    <div className="flex max-w-2xl flex-col gap-4 text-base text-ink">
      {blocks.map((block, index) => {
        if (block.type === "heading") {
          return (
            <h2 key={index} className="mt-4 text-xl font-bold text-navy-900">
              {block.text}
            </h2>
          );
        }
        if (block.type === "list") {
          return (
            <ul key={index} className="ml-5 flex list-disc flex-col gap-1.5">
              {block.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          );
        }
        return <p key={index}>{block.text}</p>;
      })}
    </div>
  );
}
