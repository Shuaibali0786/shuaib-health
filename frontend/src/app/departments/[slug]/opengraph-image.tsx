import { departments } from "@/data/departments";
import { getDepartmentBySlug } from "@/lib/content";
import { OG_SIZE, ogCard } from "@/lib/og";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "Sample department at Shuaib Health";

export function generateStaticParams(): Array<{ slug: string }> {
  return departments.map((department) => ({ slug: department.slug }));
}

/** Social card for a sample department: its name and one-line summary on the brand card. */
export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const department = await getDepartmentBySlug(slug);
  return ogCard({ eyebrow: "Sample department", title: department?.name ?? "Department", subtitle: department?.summary });
}
