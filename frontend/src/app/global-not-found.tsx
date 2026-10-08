import type { Metadata } from "next";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import { AnnouncementBar } from "@/components/layout/AnnouncementBar";
import { NoticeBar } from "@/components/layout/NoticeBar";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SkipLink } from "@/components/layout/SkipLink";
import NotFound from "./(site)/not-found";
import "./(site)/site.css";

/**
 * The 404 for URLs that match no route. With two root layouts (site and admin) there is no single
 * layout to render it in, so it carries the public site's chrome itself. A notFound() thrown inside
 * a public page still renders (site)/not-found.tsx inside the site layout.
 */
const jakarta = Plus_Jakarta_Sans({ variable: "--font-jakarta", subsets: ["latin"], display: "swap" });
const inter = Inter({ variable: "--font-inter", subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false, follow: false },
};

export default function GlobalNotFound() {
  return (
    <html lang="en" className={`${jakarta.variable} ${inter.variable}`}>
      <body className="flex min-h-screen flex-col">
        <SkipLink />
        <AnnouncementBar />
        <NoticeBar />
        <SiteHeader />
        <main id="main-content" tabIndex={-1} className="flex-1">
          <NotFound />
        </main>
        <SiteFooter />
      </body>
    </html>
  );
}
