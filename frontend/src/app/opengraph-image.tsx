import { siteConfig } from "@/data/siteConfig";
import { OG_SIZE, ogCard } from "@/lib/og";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = `${siteConfig.name}: ${siteConfig.tagline}`;

/** Site-wide social card, inherited by every page that has no card of its own. */
export default function OpenGraphImage() {
  return ogCard({ title: siteConfig.name, subtitle: siteConfig.tagline });
}
