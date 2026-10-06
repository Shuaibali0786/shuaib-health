import type { Metadata, Viewport } from "next";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import { NoticeBar } from "@/components/layout/NoticeBar";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SkipLink } from "@/components/layout/SkipLink";
import { getSiteConfig } from "@/lib/content";
import { siteUrl } from "@/lib/seo";
import { THEME_COLOR } from "../theme-color";
import "./site.css";

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  display: "swap",
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  const site = await getSiteConfig();
  return {
    // Base for canonical and Open Graph URLs; SITE_URL is optional (see .env.example).
    metadataBase: new URL(siteUrl()),
    title: {
      default: site.fullTitle,
      template: `%s | ${site.name}`,
    },
    description: "Find a doctor, book an appointment and see lab tests. Portfolio demo — not a real clinic, not medical advice.",
    applicationName: site.name,
    // While the site is a demo, keep search engines from presenting it as a real provider.
    robots: site.indexable ? { index: true, follow: true } : { index: false, follow: false },
  };
}

export const viewport: Viewport = {
  themeColor: THEME_COLOR,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${jakarta.variable} ${inter.variable}`}>
      <body className="flex min-h-screen flex-col">
        <SkipLink />
        <NoticeBar />
        <SiteHeader />
        <main id="main-content" tabIndex={-1} className="flex-1">
          {children}
        </main>
        <SiteFooter />
      </body>
    </html>
  );
}
