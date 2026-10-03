import type { Metadata } from "next";
import { CtaBand } from "@/components/home/CtaBand";
import { DepartmentGrid } from "@/components/home/DepartmentGrid";
import { FactsBand } from "@/components/home/FactsBand";
import { FeaturedDoctors } from "@/components/home/FeaturedDoctors";
import { HealthTips } from "@/components/home/HealthTips";
import { Hero } from "@/components/home/Hero";
import { QuickActions } from "@/components/home/QuickActions";
import { WhyChooseUs } from "@/components/home/WhyChooseUs";
import { siteConfig } from "@/data/siteConfig";
import { loadDepartments } from "@/lib/content";

export const revalidate = 300;

// "absolute" skips the "%s | Shuaib Health" template, so the Home title is not doubled.
export const metadata: Metadata = {
  title: { absolute: siteConfig.fullTitle },
  alternates: { canonical: "/" },
};

/** The eight Home sections, in the order required by the spec. Backgrounds alternate for a calm rhythm. */
export default async function HomePage() {
  // The same cached, per-render-shared load that DepartmentGrid uses; the count feeds the facts band.
  const departments = await loadDepartments();
  return (
    <>
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
