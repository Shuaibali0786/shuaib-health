import { getSiteConfig } from "@/lib/content";
import { OG_SIZE, ogCard } from "@/lib/og";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "Site preview card";
export const revalidate = 300;

/** Site-wide social card, inherited by every page that has no card of its own. */
export default async function OpenGraphImage() {
  const site = await getSiteConfig();
  return ogCard({ title: site.name, subtitle: site.tagline || undefined });
}
