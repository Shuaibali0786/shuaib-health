import { getDoctorBySlug, getDoctors } from "@/lib/content";
import { OG_SIZE, ogCard } from "@/lib/og";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "Sample doctor profile at Shuaib Health";

export async function generateStaticParams(): Promise<Array<{ slug: string }>> {
  return (await getDoctors()).map((doctor) => ({ slug: doctor.slug }));
}

/** Social card for a sample doctor: name and specialty on the brand card. */
export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const doctor = await getDoctorBySlug(slug);
  return ogCard({
    eyebrow: "Sample doctor profile",
    title: doctor?.fullName ?? "Doctor",
    subtitle: doctor?.specialty,
  });
}
