import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { NextAvailable } from "@/components/doctors/NextAvailable";
import { ScheduleTable } from "@/components/doctors/ScheduleTable";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ImageWithFallback } from "@/components/ui/ImageWithFallback";
import { IllustrativeNote } from "@/components/ui/IllustrativeNote";
import { SampleBadge } from "@/components/ui/SampleBadge";
import { Section } from "@/components/ui/Section";
import { doctors } from "@/data/doctors";
import { getDepartments, getDoctorBySlug } from "@/lib/content";
import { formatPkr } from "@/lib/format";
import { getManifestEntry } from "@/lib/pages";
import { departmentPath, doctorPath, ROUTES } from "@/lib/routes";
import { pageMetadata } from "@/lib/seo";

/** Only the sample doctors exist; any other slug is the not-found page. */
export const dynamicParams = false;

export function generateStaticParams(): Array<{ slug: string }> {
  return doctors.map((doctor) => ({ slug: doctor.slug }));
}

export async function generateMetadata({ params }: PageProps<"/doctors/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  return pageMetadata(getManifestEntry(doctorPath(slug)));
}

export default async function DoctorProfilePage({ params }: PageProps<"/doctors/[slug]">) {
  const { slug } = await params;
  const doctor = await getDoctorBySlug(slug);
  if (!doctor) notFound();
  const department = (await getDepartments()).find((candidate) => candidate.id === doctor.departmentId);

  return (
    <>
      <PageHeader
        trail={[{ label: "Doctors", href: ROUTES.doctors }, { label: doctor.fullName }]}
        eyebrow={doctor.specialty}
        title={doctor.fullName}
      >
        <SampleBadge label="Sample profile" />
      </PageHeader>

      <Section tone="background" spacing="compact" aria-label={`About ${doctor.fullName}`}>
        <div className="grid gap-8 lg:grid-cols-[minmax(0,20rem)_1fr] lg:gap-12">
          <div className="mx-auto w-full max-w-xs lg:mx-0">
            <Card className="overflow-hidden">
              <ImageWithFallback image={doctor.photo} sizes="(min-width: 1024px) 320px, 320px" priority />
            </Card>
            <IllustrativeNote subject="person" className="mt-2" />
          </div>

          <div className="flex min-w-0 flex-col gap-8">
            <dl className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
              <div>
                <dt className="text-sm text-muted">Specialty</dt>
                <dd className="text-base font-semibold text-navy-900">
                  {department ? (
                    <Link href={departmentPath(department.slug)} className="text-teal-700 underline underline-offset-2">
                      {doctor.specialty}
                    </Link>
                  ) : (
                    doctor.specialty
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-muted">Consultation fee</dt>
                <dd className="text-base font-semibold text-navy-900">
                  {formatPkr(doctor.feePkr)} <span className="font-normal text-muted">(sample fee)</span>
                </dd>
              </div>
              <div>
                <dt className="text-sm text-muted">Qualifications</dt>
                <dd className="text-base font-semibold text-navy-900">{doctor.qualifications.join(", ")}</dd>
              </div>
              <div>
                <dt className="text-sm text-muted">Experience</dt>
                <dd className="text-base font-semibold text-navy-900">
                  {doctor.experienceYears} years <span className="font-normal text-muted">(sample figure)</span>
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-sm text-muted">Languages</dt>
                <dd className="text-base font-semibold text-navy-900">{doctor.languages.join(", ")}</dd>
              </div>
            </dl>

            <div>
              <h2 className="text-xl font-bold">About {doctor.fullName}</h2>
              <p className="mt-2 max-w-2xl text-base text-ink">{doctor.bio}</p>
            </div>

            <div>
              <h2 className="mb-3 text-xl font-bold">Weekly schedule</h2>
              <ScheduleTable schedule={doctor.schedule} />
              <NextAvailable schedule={doctor.schedule} className="mt-3 text-base" />
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button href={ROUTES.bookAppointment} variant="accent">
                Book appointment
              </Button>
              {department ? (
                <Button href={departmentPath(department.slug)} variant="outline">
                  {department.name} department
                </Button>
              ) : null}
            </div>
            <p className="text-sm text-muted">Booking is not available in this demo yet. This is a sample profile; nothing here is real.</p>
          </div>
        </div>
      </Section>
    </>
  );
}
