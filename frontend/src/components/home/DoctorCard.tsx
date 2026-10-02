import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { NextAvailable } from "@/components/doctors/NextAvailable";
import { Card } from "@/components/ui/Card";
import { ImageWithFallback } from "@/components/ui/ImageWithFallback";
import { SampleBadge } from "@/components/ui/SampleBadge";
import { cn } from "@/lib/cn";
import { formatPkr } from "@/lib/format";
import { doctorPath } from "@/lib/routes";
import type { Doctor } from "@/types/content";

interface DoctorCardProps {
  doctor: Doctor;
  /**
   * "home" (default): photo with a "Sample" badge, name, specialty, fee.
   * "detailed": adds qualifications, languages and the next available day, with a "Sample
   * profile" label; the photo sits beside the text on phones to keep the list short.
   */
  variant?: "home" | "detailed";
}

/**
 * A sample doctor, with one "View profile" link stretched over the card (no nested links).
 */
export function DoctorCard({ doctor, variant = "home" }: DoctorCardProps) {
  const detailed = variant === "detailed";
  return (
    <Card as="article" interactive className={cn("flex w-full overflow-hidden", detailed ? "flex-row sm:flex-col" : "flex-col")}>
      <div className={cn("relative", detailed && "w-28 shrink-0 self-start sm:w-full")}>
        <ImageWithFallback
          image={doctor.photo}
          sizes={
            detailed
              ? "(min-width: 1280px) 360px, (min-width: 1024px) 30vw, (min-width: 640px) 45vw, 112px"
              : "(min-width: 1280px) 280px, (min-width: 640px) 45vw, 78vw"
          }
        />
        {!detailed && doctor.isSample ? <SampleBadge className="absolute left-3 top-3" /> : null}
      </div>
      <div className={cn("flex min-w-0 flex-1 flex-col", detailed ? "p-4 sm:p-5" : "p-5")}>
        {detailed ? <SampleBadge label="Sample profile" className="mb-2 self-start" /> : null}
        <h3 className="text-lg font-bold">{doctor.fullName}</h3>
        <p className="mt-0.5 text-base font-semibold text-teal-700">{doctor.specialty}</p>
        {detailed ? (
          <>
            <p className="mt-2 text-sm text-ink">{doctor.qualifications.join(", ")}</p>
            <p className="mt-1 text-sm text-muted">
              Languages: <span className="text-ink">{doctor.languages.join(", ")}</span>
            </p>
          </>
        ) : null}
        <p className="mt-3 text-sm text-muted">
          Consultation fee <span className="ml-1 text-base font-bold text-navy-900">{formatPkr(doctor.feePkr)}</span>
          {detailed ? <span className="ml-1">(sample)</span> : null}
        </p>
        {detailed ? <NextAvailable schedule={doctor.schedule} className="mt-1 text-sm" /> : null}
        <Link
          href={doctorPath(doctor.slug)}
          aria-label={`View profile: ${doctor.fullName}`}
          className="mt-auto inline-flex items-center gap-1 pt-4 text-sm font-semibold text-teal-700 after:absolute after:inset-0 after:rounded-card hover:underline"
        >
          View profile
          <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
      </div>
    </Card>
  );
}
