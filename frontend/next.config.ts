import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  images: {
    formats: ["image/avif", "image/webp"],
  },
  experimental: {
    // Tailwind keeps the stylesheet small (about 8 kB), so inlining it in the HTML removes a
    // render-blocking request on first visit. Recommended by the Next docs for exactly this case.
    inlineCss: true,
  },
};

export default nextConfig;
