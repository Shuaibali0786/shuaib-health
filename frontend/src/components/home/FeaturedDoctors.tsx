import { Reveal } from "@/components/ui/Reveal";
import { Section } from "@/components/ui/Section";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { getFeaturedDoctors } from "@/lib/content";
import { REVEAL_STAGGER } from "@/lib/motion";
import { DoctorCard } from "./DoctorCard";

/** Featured doctors (FR-016): 3 to 4 sample doctors, one column on phones, two from sm, four from xl. */
export async function FeaturedDoctors() {
  const doctors = await getFeaturedDoctors();

  return (
    <Section tone="surface" labelledBy="doctors-title">
      <Reveal>
        <SectionHeading
          id="doctors-title"
          eyebrow="Our doctors"
          title="Featured doctors"
          intro="These are sample doctors for the demo. The names, photos and fees are not real."
        />
      </Reveal>
      <ul className="mt-10 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {doctors.map((doctor, index) => (
          <Reveal as="li" key={doctor.id} delay={(index % 4) * REVEAL_STAGGER} className="flex">
            <DoctorCard doctor={doctor} />
          </Reveal>
        ))}
      </ul>
    </Section>
  );
}
