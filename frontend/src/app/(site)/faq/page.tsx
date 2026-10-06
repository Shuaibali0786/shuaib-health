import type { Metadata } from "next";
import Link from "next/link";
import { FaqGroupSection } from "@/components/faq/FaqGroup";
import { PageHeader } from "@/components/layout/PageHeader";
import { SampleBadge } from "@/components/ui/SampleBadge";
import { Section } from "@/components/ui/Section";
import { getFaqGroups, getSiteConfig } from "@/lib/content";
import { getManifestEntry } from "@/lib/pages";
import { ROUTES } from "@/lib/routes";
import { pageMetadata } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata(getManifestEntry(ROUTES.faq), await getSiteConfig());
}

export default async function FaqPage() {
  const groups = await getFaqGroups();

  return (
    <>
      <PageHeader
        trail={[{ label: "FAQ" }]}
        title="Frequently asked questions"
        intro="Short answers about appointments, lab tests and reports, payments, home sample collection and privacy."
      >
        <p className="flex flex-wrap items-center gap-2 text-sm text-muted">
          <SampleBadge label="Sample answers" />
          <span>This is a demo. Where a service is not live yet, the answer says so.</span>
        </p>
      </PageHeader>
      <Section tone="background" spacing="compact" aria-label="Questions and answers">
        <nav aria-label="FAQ groups">
          <ul className="flex flex-wrap gap-2">
            {groups.map((group) => (
              <li key={group.id}>
                <Link
                  href={`#${group.slug}`}
                  className="inline-flex min-h-11 items-center rounded-pill border-2 border-border-strong bg-white px-4 text-sm font-semibold text-navy-900 hover:bg-surface"
                >
                  {group.title}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="mt-10 flex max-w-3xl flex-col gap-12">
          {groups.map((group) => (
            <FaqGroupSection key={group.id} group={group} />
          ))}
        </div>
      </Section>
    </>
  );
}
