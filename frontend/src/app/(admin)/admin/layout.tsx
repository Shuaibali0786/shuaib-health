import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Inter } from "next/font/google";
import { cookies } from "next/headers";
import { AdminMarker } from "@/admin/ui/AdminMarker";
import { DEMO_NOTICE } from "@/lib/honesty";
import { THEME_COLOR } from "../../theme-color";
import "./admin.css";

const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  display: "swap",
});

// A different font module from the public site Inter (own variable and weights), so the bundler cannot
// share one stylesheet of font faces between the two root layouts (that would put Cormorant in public pages).
const inter = Inter({ variable: "--font-admin-inter", subsets: ["latin"], weight: ["400", "500", "600"], display: "swap" });

export const metadata: Metadata = {
  title: { default: "Command Centre", template: "%s | Command Centre" },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { themeColor: THEME_COLOR };

type ThemePreference = "light" | "dark" | "system";

function parsePreference(value: string | undefined): ThemePreference {
  return value === "dark" || value === "system" ? value : "light";
}

/**
 * Own root layout for the staff app. `cc_theme` is read on the server, so the theme is on <html>
 * before the first paint (no flash) and works without JavaScript; "system" is resolved by CSS.
 */
export default async function AdminRootLayout({ children }: LayoutProps<"/admin">) {
  const preference = parsePreference((await cookies()).get("cc_theme")?.value);
  return (
    <html
      lang="en"
      data-theme={preference === "dark" ? "dark" : "light"}
      data-theme-pref={preference}
      className={`${cormorant.variable} ${inter.variable}`}
    >
      <body>
        <AdminMarker />
        {children}
        <p className="disclaimer">{DEMO_NOTICE} All names and numbers are sample data.</p>
      </body>
    </html>
  );
}
