import { getSiteConfig } from "@/lib/content";
import { OG_SIZE, sectionCard } from "@/lib/og";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "About us: site preview card";
export const revalidate = 300;

/** Social card for this section; the page's own openGraph metadata would otherwise drop the site-wide card. */
export default async function OpenGraphImage() {
  return sectionCard("About us", await getSiteConfig());
}
