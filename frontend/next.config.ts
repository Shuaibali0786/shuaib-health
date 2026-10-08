import type { NextConfig } from "next";

// Staff pages and their BFF are private: never cached, never indexed, never leaked through a referrer
// and never framed (FR-037). Applies to redirects and error responses too.
const PRIVATE_HEADERS = [
  { key: "Cache-Control", value: "no-store" },
  { key: "X-Robots-Tag", value: "noindex" },
  { key: "Referrer-Policy", value: "no-referrer" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
];

const nextConfig: NextConfig = {
  // Each e2e server builds into its own folder (NEXT_DIST_DIR) so builds never collide. Unset means .next.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  poweredByHeader: false,
  reactStrictMode: true,
  images: {
    formats: ["image/avif", "image/webp"],
  },
  async headers() {
    return [
      { source: "/admin", headers: PRIVATE_HEADERS },
      { source: "/admin/:path*", headers: PRIVATE_HEADERS },
      { source: "/api/admin/:path*", headers: PRIVATE_HEADERS },
    ];
  },
  experimental: {
    // Two root layouts (site, admin) mean no single layout can render the global 404.
    globalNotFound: true,
    // Tailwind keeps the stylesheet small (about 8 kB), so inlining it in the HTML removes a
    // render-blocking request on first visit. Recommended by the Next docs for exactly this case.
    inlineCss: true,
  },
};

export default nextConfig;
