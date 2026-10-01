import type { Metadata } from "next";
import { Hero } from "@/components/home/Hero";
import { siteConfig } from "@/data/siteConfig";

// "absolute" skips the "%s | Shuaib Health" template, so the Home title is not doubled.
export const metadata: Metadata = {
  title: { absolute: siteConfig.fullTitle },
};

export default function HomePage() {
  return <Hero />;
}
