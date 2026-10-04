import { DataUnavailable } from "@/components/ui/DataUnavailable";
import { Reveal } from "@/components/ui/Reveal";
import { Section } from "@/components/ui/Section";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { getSiteConfig, loadDepartments } from "@/lib/content";
import { REVEAL_STAGGER } from "@/lib/motion";
import { DepartmentCard } from "./DepartmentCard";
import { DEPARTMENT_ITEM, DEPARTMENT_LIST } from "./department-grid";

/** The seven departments (FR-013): compact two-column cards on phones, three from lg, four from xl, with a short last row centred. */
export async function DepartmentGrid() {
  const [departments, { emergencyPhone }] = await Promise.all([loadDepartments(), getSiteConfig()]);

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
      {departments.ok ? (
        <ul className={`mt-10 ${DEPARTMENT_LIST}`}>
          {departments.data.map((department, index) => (
            <Reveal as="li" key={department.id} delay={(index % 4) * REVEAL_STAGGER} className={DEPARTMENT_ITEM}>
              <DepartmentCard department={department} />
            </Reveal>
          ))}
        </ul>
      ) : (
        <div className="mt-10">
          <DataUnavailable phone={emergencyPhone} href="/" />
        </div>
      )}
    </Section>
  );
}
