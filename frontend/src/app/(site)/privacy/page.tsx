import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/LegalPage";
import { getLegalContent, getSiteConfig } from "@/lib/content";
import { getManifestEntry } from "@/lib/pages";
import { ROUTES } from "@/lib/routes";
import { pageMetadata } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata(getManifestEntry(ROUTES.privacy), await getSiteConfig());
}

export default async function PrivacyPage() {
  return <LegalPage content={await getLegalContent("privacy")} />;
}
