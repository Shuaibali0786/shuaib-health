import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PresetShowcase } from "@/components/presets/PresetShowcase";
import { getSiteConfig } from "@/lib/content";
import { isDemoEnabled } from "@/lib/demo";
import { getManifestEntry } from "@/lib/pages";
import { pageMetadata } from "@/lib/seo";
import { PRESET_IDS, SPECIALTIES_PATH, getPreset, presetPath } from "@/presets/specialties";

// Four static pages; any other id is the normal 404 (Feature 009, ADR-0012).
export const dynamicParams = false;

export function generateStaticParams(): Array<{ preset: string }> {
  return PRESET_IDS.map((preset) => ({ preset }));
}

export async function generateMetadata({ params }: PageProps<"/demo/specialties/[preset]">): Promise<Metadata> {
  const { preset: id } = await params;
  const preset = getPreset(id);
  if (!preset) return { robots: { index: false, follow: false } };
  // Demo showcase: never indexed (memory: the demo clinic stays noindex).
  return { ...pageMetadata(getManifestEntry(presetPath(preset.id)), await getSiteConfig()), robots: { index: false, follow: false } };
}

export default async function SpecialtyPresetPage({ params }: PageProps<"/demo/specialties/[preset]">) {
  if (!isDemoEnabled()) notFound();
  const { preset: id } = await params;
  const preset = getPreset(id);
  if (!preset) notFound();
  return <PresetShowcase preset={preset} trail={[{ label: "Choose your specialty", href: SPECIALTIES_PATH }, { label: preset.label }]} />;
}
