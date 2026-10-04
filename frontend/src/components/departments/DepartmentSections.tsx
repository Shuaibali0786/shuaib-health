import { Check } from "lucide-react";
import { DoctorList } from "@/components/doctors/DoctorList";
import { LabTestCard } from "@/components/lab-tests/LabTestCard";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { DataUnavailable } from "@/components/ui/DataUnavailable";
import { ImageWithFallback } from "@/components/ui/ImageWithFallback";
import { IllustrativeNote } from "@/components/ui/IllustrativeNote";
import { Section } from "@/components/ui/Section";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { departmentPath, ROUTES } from "@/lib/routes";
import type { Department, Doctor, LabTest, LabTestCategory, PhoneNumber } from "@/types/content";

interface DepartmentSectionsProps {
  department: Department;
  /** `null` means the doctors could not be loaded; that section shows a friendly message. */
  doctors: Doctor[] | null;
  /** `null` means the lab tests could not be loaded; that section shows a friendly message. */
  tests: LabTest[] | null;
  categories: LabTestCategory[];
  /** Shown as a "Call the clinic" link in a section whose data is unavailable. */
  phone?: PhoneNumber;
}

function CheckList({ items }: { items: string[] }) {
  return (
    <ul className="mt-5 grid gap-3 sm:grid-cols-2">
      {items.map((item) => (
        <li key={item} className="flex items-start gap-3 text-base text-ink">
          <Check className="mt-1 size-5 shrink-0 text-teal-700" aria-hidden="true" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

/**
 * The body of a department page: overview with photo, conditions and services lists, the
 * department's doctors, related lab tests, and a booking button. Lists are general orientation
 * only: no diagnosis, no treatment claims.
 */
export function DepartmentSections({ department, doctors, tests, categories, phone }: DepartmentSectionsProps) {
  return (
    <>
      <Section tone="background" spacing="compact" labelledBy="overview-title">
        <div className="grid items-start gap-8 lg:grid-cols-[1fr_minmax(0,28rem)] lg:gap-12">
          <div>
            <h2 id="overview-title" className="text-2xl font-bold md:text-3xl">
              Overview
            </h2>
            <p className="mt-3 max-w-2xl text-base text-ink md:text-lg">{department.overview}</p>
            <div className="mt-6">
              <Button href={ROUTES.bookAppointment} variant="accent">
                Book appointment
              </Button>
              <p className="mt-2 text-sm text-muted">Booking is not available in this demo yet.</p>
            </div>
          </div>
          <div>
            <Card className="overflow-hidden">
              <ImageWithFallback image={department.image} sizes="(min-width: 1024px) 448px, 92vw" priority />
            </Card>
            <IllustrativeNote subject="facility" className="mt-2" />
          </div>
        </div>
      </Section>

      <Section tone="surface" spacing="compact" labelledBy="conditions-title">
        <div className="grid gap-10 lg:grid-cols-2 lg:gap-12">
          <div>
            <SectionHeading id="conditions-title" title="Common conditions (general list)" intro="A general list for orientation. It is not a diagnosis guide; ask a doctor about your own symptoms." />
            <CheckList items={department.conditions} />
          </div>
          <div>
            <SectionHeading id="services-title" title="Services offered" intro="Sample services for this demo department." />
            <CheckList items={department.services} />
          </div>
        </div>
      </Section>

      <Section tone="background" spacing="compact" labelledBy="doctors-title">
        <SectionHeading
          id="doctors-title"
          title={`Doctors in ${department.name}`}
          intro="Sample doctors. Fees and schedules are invented for the demo."
        />
        <div className="mt-8">
          {doctors ? <DoctorList doctors={doctors} /> : <DataUnavailable phone={phone} href={departmentPath(department.slug)} />}
        </div>
      </Section>

      <Section tone="surface" spacing="compact" labelledBy="tests-title">
        <SectionHeading
          id="tests-title"
          title="Related lab tests"
          intro="Tests that doctors in this department often ask for. All prices are sample prices."
        />
        {tests ? (
          <ul className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {tests.map((test) => (
              <li key={test.id} className="flex">
                <LabTestCard test={test} category={categories.find((category) => category.id === test.categoryId)} compact />
              </li>
            ))}
          </ul>
        ) : (
          <div className="mt-8">
            <DataUnavailable phone={phone} href={departmentPath(department.slug)} />
          </div>
        )}
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Button href={ROUTES.labTests} variant="outline">
            See all lab tests
          </Button>
          <Button href={ROUTES.bookAppointment} variant="accent">
            Book appointment
          </Button>
        </div>
      </Section>
    </>
  );
}
