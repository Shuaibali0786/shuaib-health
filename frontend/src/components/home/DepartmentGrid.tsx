import { Reveal } from "@/components/ui/Reveal";
import { Section } from "@/components/ui/Section";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { getDepartments } from "@/lib/content";
import { REVEAL_STAGGER } from "@/lib/motion";
import { DepartmentCard } from "./DepartmentCard";

/** The seven departments (FR-013): one column on phones, two from sm, three from lg, four from xl. */
export async function DepartmentGrid() {
  const departments = await getDepartments();

  return (
    <Section tone="surface" labelledBy="departments-title">
      <Reveal>
        <SectionHeading
          id="departments-title"
          eyebrow="Departments"
          title="Our departments"
          intro="Explore the areas of care we offer."
        />
      </Reveal>
      <ul className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {departments.map((department, index) => (
          <Reveal as="li" key={department.id} delay={(index % 4) * REVEAL_STAGGER} className="flex">
            <DepartmentCard department={department} />
          </Reveal>
        ))}
      </ul>
    </Section>
  );
}
