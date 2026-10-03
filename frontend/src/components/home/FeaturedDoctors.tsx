import { Button } from "@/components/ui/Button";
import { DataUnavailable } from "@/components/ui/DataUnavailable";
import { Reveal } from "@/components/ui/Reveal";
import { Section } from "@/components/ui/Section";
import { SWIPE_ITEM, SWIPE_ROW } from "@/components/ui/swipe-row";
import { SwipeList } from "@/components/ui/SwipeList";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { loadFeaturedDoctors } from "@/lib/content";
import { cn } from "@/lib/cn";
import { ROUTES } from "@/lib/routes";
import { DoctorCard } from "./DoctorCard";

/**
 * Featured doctors (FR-016): 3 to 4 sample doctors. A swipe row on phones (next card peeking),
 * two columns from sm, four from xl, with a link to all doctors.
 */
export async function FeaturedDoctors() {
  const doctors = await loadFeaturedDoctors();

  return (
    <Section tone="surface" labelledBy="doctors-title">
      <Reveal className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <SectionHeading
          id="doctors-title"
          eyebrow="Our doctors"
          title="Featured doctors"
          intro="These are sample doctors for the demo. The names, fees and details are fictional, and the photos are stock photos of models."
        />
        <Button href={ROUTES.doctors} variant="outline" className="self-start sm:self-auto">
          View all doctors
        </Button>
      </Reveal>
      <Reveal className="mt-10">
        {doctors.ok ? (
          <SwipeList className={cn("grid gap-5 sm:grid-cols-2 xl:grid-cols-4", SWIPE_ROW)}>
            {doctors.data.map((doctor) => (
              <li key={doctor.id} className={cn("flex", SWIPE_ITEM)}>
                <DoctorCard doctor={doctor} />
              </li>
            ))}
          </SwipeList>
        ) : (
          <DataUnavailable href="/" />
        )}
      </Reveal>
    </Section>
  );
}
