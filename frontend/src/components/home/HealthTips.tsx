import { Button } from "@/components/ui/Button";
import { Reveal } from "@/components/ui/Reveal";
import { Section } from "@/components/ui/Section";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { getLatestHealthTips } from "@/lib/content";
import { REVEAL_STAGGER } from "@/lib/motion";
import { ROUTES } from "@/lib/routes";
import { TipCard } from "./TipCard";

/** The three latest health tips (FR-017), newest first, with a link to all tips. */
export async function HealthTips() {
  const tips = await getLatestHealthTips(3);

  return (
    <Section labelledBy="tips-title">
      <Reveal className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <SectionHeading
          id="tips-title"
          eyebrow="Health tips"
          title="Latest health tips"
          intro="Simple, everyday ideas for feeling well. Sample articles for the demo."
        />
        <Button href={ROUTES.healthTips} variant="outline" className="self-start sm:self-auto">
          View all tips
        </Button>
      </Reveal>
      <ul className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {tips.map((tip, index) => (
          <Reveal as="li" key={tip.id} delay={index * REVEAL_STAGGER} className="flex">
            <TipCard tip={tip} />
          </Reveal>
        ))}
      </ul>
    </Section>
  );
}
