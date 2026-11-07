import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PresetShowcase } from "@/components/presets/PresetShowcase";
import { getSiteConfig } from "@/lib/content";
import { isDemoEnabled } from "@/lib/demo";
import { getManifestEntry } from "@/lib/pages";
import { pageMetadata } from "@/lib/seo";
import { DEFAULT_PRESET, SPECIALTIES_PATH, getPreset } from "@/presets/specialties";

export async function generateMetadata(): Promise<Metadata> {
  // Demo showcase: never indexed (memory: the demo clinic stays noindex).
  return { ...pageMetadata(getManifestEntry(SPECIALTIES_PATH), await getSiteConfig()), robots: { index: false, follow: false } };
}

/** `/demo/specialties` shows the Multi-speciality preset first (Feature 009). Demo only. */
export default function SpecialtiesIndex() {
  if (!isDemoEnabled()) notFound();
  const preset = getPreset(DEFAULT_PRESET);
  if (!preset) notFound();
  return <PresetShowcase preset={preset} trail={[{ label: "Choose your specialty" }]} />;
}
