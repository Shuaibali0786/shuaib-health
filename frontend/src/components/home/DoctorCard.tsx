import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { ImageWithFallback } from "@/components/ui/ImageWithFallback";
import { SampleBadge } from "@/components/ui/SampleBadge";
import { formatPkr } from "@/lib/format";
import { doctorPath } from "@/lib/routes";
import type { Doctor } from "@/types/content";

/**
 * A sample doctor: photo with a "Sample" badge, name, specialty, fee in PKR, and one
 * "View profile" link stretched over the card (no nested links).
 */
export function DoctorCard({ doctor }: { doctor: Doctor }) {
  return (
    <Card as="article" interactive className="flex w-full flex-col overflow-hidden">
      <div className="relative">
        <ImageWithFallback
          image={doctor.photo}
          sizes="(min-width: 1280px) 280px, (min-width: 640px) 45vw, 78vw"
        />
        {doctor.isSample ? <SampleBadge className="absolute left-3 top-3" /> : null}
      </div>
      <div className="flex flex-1 flex-col p-5">
        <h3 className="text-lg font-bold">{doctor.fullName}</h3>
        <p className="mt-0.5 text-base font-semibold text-teal-700">{doctor.specialty}</p>
        <p className="mt-3 text-sm text-muted">
          Consultation fee <span className="ml-1 text-base font-bold text-navy-900">{formatPkr(doctor.feePkr)}</span>
        </p>
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
