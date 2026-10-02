import { Reveal } from "@/components/ui/Reveal";
import { Section } from "@/components/ui/Section";
import { SWIPE_ITEM, SWIPE_ROW } from "@/components/ui/swipe-row";
import { SwipeList } from "@/components/ui/SwipeList";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { getFeaturedDoctors } from "@/lib/content";
import { cn } from "@/lib/cn";
import { DoctorCard } from "./DoctorCard";

/**
 * Featured doctors (FR-016): 3 to 4 sample doctors. A swipe row on phones (next card peeking),
 * two columns from sm, four from xl.
 */
export async function FeaturedDoctors() {
  const doctors = await getFeaturedDoctors();

  return (
    <Section tone="surface" labelledBy="doctors-title">
      <Reveal>
        <SectionHeading
          id="doctors-title"
          eyebrow="Our doctors"
          title="Featured doctors"
          intro="These are sample doctors for the demo. The names, fees and details are fictional, and the photos are stock photos of models."
        />
      </Reveal>
      <Reveal className="mt-10">
        <SwipeList className={cn("grid gap-5 sm:grid-cols-2 xl:grid-cols-4", SWIPE_ROW)}>
          {doctors.map((doctor) => (
            <li key={doctor.id} className={cn("flex", SWIPE_ITEM)}>
              <DoctorCard doctor={doctor} />
            </li>
          ))}
        </SwipeList>
      </Reveal>
    </Section>
  );
}
