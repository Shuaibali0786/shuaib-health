import { DoctorCard } from "@/components/home/DoctorCard";
import type { Doctor } from "@/types/content";

/** A responsive grid of detailed doctor cards. Used by the filter island and its server-rendered fallback. */
export function DoctorList({ doctors }: { doctors: Doctor[] }) {
  return (
    <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {doctors.map((doctor) => (
        <li key={doctor.id} className="flex">
          <DoctorCard doctor={doctor} variant="detailed" />
        </li>
      ))}
    </ul>
  );
}
