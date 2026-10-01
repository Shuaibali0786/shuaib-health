import { Button } from "@/components/ui/Button";
import { Reveal } from "@/components/ui/Reveal";
import { Section } from "@/components/ui/Section";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { SWIPE_ITEM, SWIPE_ROW } from "@/components/ui/swipe-row";
import { SwipeList } from "@/components/ui/SwipeList";
import { cn } from "@/lib/cn";
import { getLatestHealthTips } from "@/lib/content";
import { ROUTES } from "@/lib/routes";
import { TipCard } from "./TipCard";

/**
 * The three latest health tips (FR-017), newest first, with a link to all tips.
 * A swipe row on phones (next card peeking), two columns from sm, three from lg.
 */
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
      <Reveal className="mt-10">
        <SwipeList className={cn("grid gap-5 sm:grid-cols-2 lg:grid-cols-3", SWIPE_ROW)}>
          {tips.map((tip) => (
            <li key={tip.id} className={cn("flex", SWIPE_ITEM)}>
              <TipCard tip={tip} />
            </li>
          ))}
        </SwipeList>
      </Reveal>
    </Section>
  );
}
