import { ImageResponse } from "next/og";
import { LOGO_VIEWBOX, PLUS_PATH, PULSE_PATH, PULSE_STROKE_WIDTH } from "@/components/brand/logo-paths";
import { siteConfig } from "@/data/siteConfig";

export const OG_SIZE = { width: 1200, height: 630 };

interface OgCardOptions {
  /** Small line above the title, for example "Doctor" or "Lab test". */
  eyebrow?: string;
  title: string;
  subtitle?: string;
}

/**
 * The social-sharing card: brand mark, optional eyebrow, a title, a subtitle and the demo notice.
 * Image generation cannot read CSS variables, so the brand colours are written out here
 * (navy-900, teal-500 and teal-700 from globals.css); tests/unit/tokens.test.ts checks they match.
 */
export function ogCard({ eyebrow, title, subtitle }: OgCardOptions): ImageResponse {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          padding: "0 80px",
          background: "#ffffff",
          color: "#0B2545",
        }}
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox={`0 0 ${LOGO_VIEWBOX} ${LOGO_VIEWBOX}`} width="200" height="200">
          <defs>
            <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#14B8A6" />
              <stop offset="1" stopColor="#0B2545" />
            </linearGradient>
          </defs>
          <path d={PLUS_PATH} fill="url(#g)" />
          <path
            d={PULSE_PATH}
            fill="none"
            stroke="#ffffff"
            strokeWidth={PULSE_STROKE_WIDTH}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <div style={{ display: "flex", flexDirection: "column", marginLeft: 56, maxWidth: 800 }}>
          {eyebrow ? <div style={{ fontSize: 32, fontWeight: 700, color: "#0F766E" }}>{eyebrow}</div> : null}
          <div style={{ fontSize: title.length > 40 ? 56 : 76, fontWeight: 800, marginTop: 8, lineHeight: 1.1 }}>{title}</div>
          {subtitle ? <div style={{ fontSize: 36, marginTop: 16 }}>{subtitle}</div> : null}
          <div style={{ fontSize: 26, marginTop: 36, color: "#0F766E" }}>{siteConfig.demoNotice}</div>
        </div>
      </div>
    ),
    { ...OG_SIZE },
  );
}
