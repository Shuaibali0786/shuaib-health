import type { Metadata } from "next";
import { VisitSteps } from "@/components/about/VisitSteps";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ImageWithFallback } from "@/components/ui/ImageWithFallback";
import { SampleBadge } from "@/components/ui/SampleBadge";
import { Section } from "@/components/ui/Section";
import { getAboutContent } from "@/lib/content";
import { getManifestEntry } from "@/lib/pages";
import { ROUTES } from "@/lib/routes";
import { pageMetadata } from "@/lib/seo";

export function generateMetadata(): Metadata {
  return pageMetadata(getManifestEntry(ROUTES.about));
}

export default async function AboutPage() {
  const about = await getAboutContent();

  return (
    <>
      <PageHeader
        trail={[{ label: "About" }]}
        title="About Shuaib Health"
        intro="An honest look at what this demo clinic is, what it aims to show, and how a visit would work."
      >
        <SampleBadge label="Portfolio demo" />
      </PageHeader>

      <Section tone="background" spacing="compact" labelledBy="story-title">
        <h2 id="story-title" className="text-2xl font-bold">
          Our story, honestly
        </h2>
        <div className="mt-4 flex max-w-2xl flex-col gap-4 text-base text-ink">
          {about.story.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </div>
      </Section>

      <Section tone="surface" spacing="compact" labelledBy="mission-title">
        <h2 id="mission-title" className="text-2xl font-bold">
          Our mission
        </h2>
        <p className="mt-4 max-w-2xl text-lg text-ink">{about.mission}</p>
      </Section>

      <Section tone="background" spacing="compact" labelledBy="values-title">
        <h2 id="values-title" className="text-2xl font-bold">
          What we value
        </h2>
        <ul className="mt-6 grid gap-5 sm:grid-cols-2">
          {about.values.map((value) => (
            <li key={value.id} className="flex">
              <Card className="w-full p-5">
                <h3 className="text-lg font-bold">{value.title}</h3>
                <p className="mt-2 text-base text-muted">{value.text}</p>
              </Card>
            </li>
          ))}
        </ul>
      </Section>

      <Section tone="surface" spacing="compact" labelledBy="photos-title">
        <h2 id="photos-title" className="text-2xl font-bold">
          Pictures of places like these
        </h2>
        <ul className="mt-6 grid gap-5 sm:grid-cols-2">
          {about.facilityPhotos.map((photo) => (
            <li key={photo.image.src}>
              <figure>
                <Card className="overflow-hidden">
                  <ImageWithFallback image={photo.image} sizes="(min-width: 640px) 45vw, 100vw" />
                </Card>
                <figcaption className="mt-2 text-sm text-muted">{photo.caption}</figcaption>
              </figure>
            </li>
          ))}
        </ul>
      </Section>

      <Section tone="background" spacing="compact" labelledBy="visit-title">
        <h2 id="visit-title" className="text-2xl font-bold">
          How a visit works
        </h2>
        <p className="mt-2 max-w-2xl text-base text-muted">Five steps from finding a doctor to following up. Some steps are not live in this demo yet.</p>
        <div className="mt-6">
          <VisitSteps steps={about.visitSteps} />
        </div>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button href={ROUTES.doctors} variant="accent">
            Find a doctor
          </Button>
          <Button href={ROUTES.labTests} variant="outline">
            Browse lab tests
          </Button>
        </div>
      </Section>
    </>
  );
}
