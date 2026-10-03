import { getLabTestBySlug, getLabTests } from "@/lib/content";
import { OG_SIZE, ogCard } from "@/lib/og";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "Sample lab test at Shuaib Health";

export async function generateStaticParams(): Promise<Array<{ slug: string }>> {
  return (await getLabTests()).map((test) => ({ slug: test.slug }));
}

/** Social card for a sample lab test: its name and what it is for on the brand card. */
export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const test = await getLabTestBySlug(slug);
  return ogCard({ eyebrow: "Sample lab test", title: test?.name ?? "Lab test", subtitle: test?.about });
}
