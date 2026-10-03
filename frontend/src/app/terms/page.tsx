import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/LegalPage";
import { getLegalContent } from "@/lib/content";
import { getManifestEntry } from "@/lib/pages";
import { ROUTES } from "@/lib/routes";
import { pageMetadata } from "@/lib/seo";

export function generateMetadata(): Metadata {
  return pageMetadata(getManifestEntry(ROUTES.terms));
}

export default async function TermsPage() {
  return <LegalPage content={await getLegalContent("terms")} />;
}
