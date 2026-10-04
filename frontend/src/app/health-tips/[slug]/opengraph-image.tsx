import { healthTips } from "@/data/healthTips";
import { getHealthTipBySlug } from "@/lib/content";
import { OG_SIZE, ogCard } from "@/lib/og";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "Sample health tip";

export function generateStaticParams(): Array<{ slug: string }> {
  return healthTips.map((tip) => ({ slug: tip.slug }));
}

/** Social card for a sample article: its title and one-line summary on the brand card. */
export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const tip = await getHealthTipBySlug(slug);
  return ogCard({ eyebrow: "Sample health tip", title: tip?.title ?? "Health tip", subtitle: tip?.summary });
}
