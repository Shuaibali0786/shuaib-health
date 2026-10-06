import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TipCard } from "@/components/home/TipCard";
import { PageHeader } from "@/components/layout/PageHeader";
import { ArticleBody } from "@/components/tips/ArticleBody";
import { MedicalNote } from "@/components/tips/MedicalNote";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ImageWithFallback } from "@/components/ui/ImageWithFallback";
import { SampleBadge } from "@/components/ui/SampleBadge";
import { Section } from "@/components/ui/Section";
import { healthTips } from "@/data/healthTips";
import { getHealthTipBySlug, getRelatedTips, getSiteConfig } from "@/lib/content";
import { formatKarachiDate } from "@/lib/format";
import { getManifestEntry } from "@/lib/pages";
import { readingMinutes } from "@/lib/readingTime";
import { ROUTES, tipPath } from "@/lib/routes";
import { pageMetadata } from "@/lib/seo";

/** Only the sample articles exist; any other slug is the not-found page. */
export const dynamicParams = false;

export function generateStaticParams(): Array<{ slug: string }> {
  return healthTips.map((tip) => ({ slug: tip.slug }));
}

export async function generateMetadata({ params }: PageProps<"/health-tips/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  return pageMetadata(getManifestEntry(tipPath(slug)), await getSiteConfig());
}

export default async function HealthTipPage({ params }: PageProps<"/health-tips/[slug]">) {
  const { slug } = await params;
  const tip = await getHealthTipBySlug(slug);
  if (!tip) notFound();
  const related = await getRelatedTips(tip.slug, 3);

  return (
    <>
      <PageHeader
        trail={[{ label: "Health Tips", href: ROUTES.healthTips }, { label: tip.title }]}
        eyebrow={tip.category}
        title={tip.title}
        intro={tip.summary}
      >
        <p className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-muted">
          <SampleBadge label="Sample article" />
          <time dateTime={tip.publishedAt}>{formatKarachiDate(tip.publishedAt)}</time>
          <span>{readingMinutes(tip.body)} min read</span>
        </p>
      </PageHeader>

      <Section tone="background" spacing="compact" aria-label={tip.title}>
        <div className="flex flex-col gap-8">
          <Card className="max-w-2xl overflow-hidden">
            <ImageWithFallback image={tip.image} sizes="(min-width: 768px) 672px, 100vw" priority />
          </Card>
          <ArticleBody blocks={tip.body} />
          <MedicalNote />
          <div>
            <Button href={ROUTES.healthTips} variant="outline">
              All health tips
            </Button>
          </div>
        </div>
      </Section>

      {related.length > 0 ? (
        <Section tone="surface" spacing="compact" aria-label="Related articles">
          <h2 className="text-2xl font-bold">Related articles</h2>
          <ul className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {related.map((other) => (
              <li key={other.id} className="flex">
                <TipCard tip={other} showMeta />
              </li>
            ))}
          </ul>
        </Section>
      ) : null}
    </>
  );
}
