import type { Metadata } from "next";
import localFont from "next/font/local";
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
// Self-hosted, as in the site layout (src/fonts/README.md).
const jakarta = localFont({
  src: "../fonts/plus-jakarta-sans-latin-variable.woff2",
  variable: "--font-jakarta",
  weight: "200 800",
  display: "swap",
});
const inter = localFont({
  src: "../fonts/inter-latin-variable.woff2",
  variable: "--font-inter",
  weight: "100 900",
  display: "swap",
});

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
