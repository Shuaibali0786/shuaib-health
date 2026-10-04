import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { NextAvailable } from "@/components/doctors/NextAvailable";
import { ScheduleTable } from "@/components/doctors/ScheduleTable";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { DataUnavailable } from "@/components/ui/DataUnavailable";
import { ImageWithFallback } from "@/components/ui/ImageWithFallback";
import { IllustrativeNote } from "@/components/ui/IllustrativeNote";
import { SampleBadge } from "@/components/ui/SampleBadge";
import { Section } from "@/components/ui/Section";
import { getSiteConfig, getDoctors, loadDepartments, loadDoctors } from "@/lib/content";
import { formatPkr } from "@/lib/format";
import { doctorEntry } from "@/lib/pages";
import { departmentPath, doctorPath, ROUTES } from "@/lib/routes";
import { pageMetadata } from "@/lib/seo";

export const revalidate = 300;

/** Doctors added after the build render on first request; a slug not in the list is the not-found page. */
export const dynamicParams = true;

export async function generateStaticParams(): Promise<Array<{ slug: string }>> {
  return (await getDoctors()).map((doctor) => ({ slug: doctor.slug }));
}

export async function generateMetadata({ params }: PageProps<"/doctors/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const doctors = await loadDoctors();
  const doctor = doctors.ok ? doctors.data.find((candidate) => candidate.slug === slug) : undefined;
  // An outage or an unknown slug gets a generic title; the page itself decides between the
  // friendly message and the not-found page.
  return doctor ? pageMetadata(doctorEntry(doctor)) : { title: "Doctor profile", alternates: { canonical: doctorPath(slug) } };
}

export default async function DoctorProfilePage({ params }: PageProps<"/doctors/[slug]">) {
  const { emergencyPhone: phone } = await getSiteConfig();
  const { slug } = await params;
  const [doctors, departments] = await Promise.all([loadDoctors(), loadDepartments()]);
  if (!doctors.ok) {
    return (
      <>
        <PageHeader trail={[{ label: "Doctors", href: ROUTES.doctors }, { label: "Doctor profile" }]} title="Doctor profile" />
        <Section tone="background" spacing="compact" aria-label="Doctor profile">
          <DataUnavailable phone={phone} href={doctorPath(slug)} />
        </Section>
      </>
    );
  }
  const doctor = doctors.data.find((candidate) => candidate.slug === slug);
  if (!doctor) notFound();
  const department = departments.ok ? departments.data.find((candidate) => candidate.id === doctor.departmentId) : undefined;

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
