/**
 * Structured data as a JSON-LD script. This is the one place in src that sets inner HTML: the text is
 * `JSON.stringify` output of our own data, with "<" escaped so the data can never close the tag.
 */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }} />;
}
