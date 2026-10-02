import { ImageResponse } from "next/og";
import { LOGO_VIEWBOX, PLUS_PATH, PULSE_PATH, PULSE_STROKE_WIDTH } from "@/components/brand/logo-paths";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/**
 * iOS home-screen icon, drawn from the same mark geometry as the logo.
 * Image generation cannot read CSS variables, so the two brand colours are
 * written out here (navy-900 and teal-500 from globals.css);
 * tests/unit/tokens.test.ts checks that they match.
 */
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#ffffff",
        }}
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox={`0 0 ${LOGO_VIEWBOX} ${LOGO_VIEWBOX}`} width="140" height="140">
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
      </div>
    ),
    { ...size },
  );
}
