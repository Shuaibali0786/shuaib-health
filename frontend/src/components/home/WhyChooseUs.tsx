import { IconTile } from "@/components/ui/IconTile";
import { ImageWithFallback } from "@/components/ui/ImageWithFallback";
import { Reveal } from "@/components/ui/Reveal";
import { Section } from "@/components/ui/Section";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { clinicImage, whyPoints } from "@/data/homeContent";
import { getSiteConfig } from "@/lib/content";
import { REVEAL_STAGGER } from "@/lib/motion";
import { EmergencyCard } from "./EmergencyCard";

/**
 * Why choose us (FR-015): five plain points beside the clinic photo, then the Emergency card.
 * On phones the photo comes first, then the points, then the card; from lg the points sit
 * on the left and the photo on the right, with the card spanning the width below.
 */
export async function WhyChooseUs() {
  const { name } = await getSiteConfig();
  return (
    <Section labelledBy="why-title">
      <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-14">
        <Reveal className="lg:order-last">
          <div className="overflow-hidden rounded-card shadow-lift">
            <ImageWithFallback image={clinicImage} sizes="(min-width: 1024px) 560px, 90vw" />
          </div>
        </Reveal>
        <div>
          <Reveal>
            <SectionHeading id="why-title" eyebrow="Why us" title={`Why choose ${name}`} />
          </Reveal>
          <ul className="mt-8 space-y-5">
            {whyPoints.map((point, index) => (
              <Reveal as="li" key={point.id} delay={index * REVEAL_STAGGER} className="flex gap-4">
                <IconTile name={point.iconName} />
                <div>
                  <h3 className="text-lg font-bold">{point.title}</h3>
                  <p className="mt-1 text-muted">{point.text}</p>
                </div>
              </Reveal>
            ))}
          </ul>
        </div>
      </div>
      <Reveal className="mt-12">
        <EmergencyCard />
      </Reveal>
    </Section>
  );
}
