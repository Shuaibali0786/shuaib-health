import { PageHeader } from "@/components/layout/PageHeader";
import { ArticleBody } from "@/components/tips/ArticleBody";
import { SampleBadge } from "@/components/ui/SampleBadge";
import { Section } from "@/components/ui/Section";
import { formatKarachiDate } from "@/lib/format";
import type { LegalContent } from "@/types/content";

/**
 * A Privacy or Terms page: breadcrumb, the page's only h1, the last-updated date, the demo notice,
 * a contents list that links to each section, and one h2 per section. Section text reuses the
 * article renderer, so it is rendered as text, never as HTML.
 */
export function LegalPage({ content }: { content: LegalContent }) {
  return (
    <>
      <PageHeader trail={[{ label: content.title }]} title={content.title} intro={content.intro}>
        <p className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-muted">
          <SampleBadge label="Portfolio demo, not legal advice" />
          <span>
            Last updated <time dateTime={content.lastUpdated}>{formatKarachiDate(content.lastUpdated)}</time>
          </span>
        </p>
      </PageHeader>

      <Section tone="background" spacing="compact" aria-label={`${content.title} details`}>
        <div className="flex max-w-3xl flex-col gap-10">
          <nav aria-label={`${content.title} contents`}>
            <h2 className="text-lg font-bold">On this page</h2>
            <ul className="mt-3 flex flex-col gap-1.5">
              {content.sections.map((section) => (
                <li key={section.id}>
                  <a href={`#${section.id}`} className="inline-flex min-h-6 items-center text-base font-medium text-teal-700 underline underline-offset-2">
                    {section.heading}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          {content.sections.map((section) => (
            <section key={section.id} id={section.id} aria-labelledby={`${section.id}-heading`} className="scroll-mt-24">
              <h2 id={`${section.id}-heading`} className="text-2xl font-bold">
                {section.heading}
              </h2>
              <div className="mt-3">
                <ArticleBody blocks={section.blocks} />
              </div>
            </section>
          ))}
        </div>
      </Section>
    </>
  );
}
