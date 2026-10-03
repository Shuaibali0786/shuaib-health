/**
 * Subtle accent per lab test category: a top bar and a pale icon tint. Decoration only; the
 * category is always also named in text. Full class names are written out so Tailwind sees them.
 */
export interface CategoryAccent {
  bar: string;
  tint: string;
}

const ACCENTS: Record<string, CategoryAccent> = {
  blood: { bar: "border-t-cat-rose", tint: "bg-cat-rose-tint" },
  diabetes: { bar: "border-t-cat-violet", tint: "bg-cat-violet-tint" },
  heart: { bar: "border-t-cat-pink", tint: "bg-cat-pink-tint" },
  liver: { bar: "border-t-cat-amber", tint: "bg-cat-amber-tint" },
  kidney: { bar: "border-t-cat-orange", tint: "bg-cat-orange-tint" },
  thyroid: { bar: "border-t-cat-indigo", tint: "bg-cat-indigo-tint" },
  vitamins: { bar: "border-t-cat-lime", tint: "bg-cat-lime-tint" },
  hormones: { bar: "border-t-cat-fuchsia", tint: "bg-cat-fuchsia-tint" },
  urine: { bar: "border-t-cat-cyan", tint: "bg-cat-cyan-tint" },
};

/** The accent for a category slug, or undefined for an unknown slug. */
export function getCategoryAccent(slug: string): CategoryAccent | undefined {
  return ACCENTS[slug];
}
