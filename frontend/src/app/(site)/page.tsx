import type { Metadata } from "next";
import { CtaBand } from "@/components/home/CtaBand";
import { DepartmentGrid } from "@/components/home/DepartmentGrid";
import { FactsBand } from "@/components/home/FactsBand";
import { FeaturedDoctors } from "@/components/home/FeaturedDoctors";
import { HealthTips } from "@/components/home/HealthTips";
import { Hero } from "@/components/home/Hero";
import { QuickActions } from "@/components/home/QuickActions";
import { WhyChooseUs } from "@/components/home/WhyChooseUs";
import { JsonLd } from "@/components/seo/JsonLd";
import { getSiteConfig, loadDepartments } from "@/lib/content";
import { organizationJsonLd } from "@/lib/seo";

export const revalidate = 300;

// "absolute" skips the "%s | <clinic name>" template, so the Home title is not doubled.
export async function generateMetadata(): Promise<Metadata> {
  const site = await getSiteConfig();
  return { title: { absolute: site.fullTitle }, alternates: { canonical: "/" } };
}

/** The eight Home sections, in the order required by the spec. Backgrounds alternate for a calm rhythm. */
export default async function HomePage() {
  // The same cached, per-render-shared load that DepartmentGrid uses; the count feeds the facts band.
  const [departments, site] = await Promise.all([loadDepartments(), getSiteConfig()]);
  return (
    <>
      <JsonLd data={organizationJsonLd(site)} />
      <Hero />
      <QuickActions />
      <DepartmentGrid />
      <FactsBand departmentCount={departments.ok ? departments.data.length : undefined} />
      <WhyChooseUs />
      <FeaturedDoctors />
      <HealthTips />
      <CtaBand />
    </>
  );
}
