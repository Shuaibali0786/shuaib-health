import { ImageResponse } from "next/og";
import { MARK_COLOURS, MARK_LARGE, MARK_VIEWBOX } from "@/lib/brand-marks";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/**
 * iOS home-screen icon: the Booking Plus mark (default drawing) on white, drawn from the same shapes as
 * the logo. Image generation cannot read CSS variables, so the colours come from brand-marks.ts;
 * tests/unit/tokens.test.ts checks that they match the --color-brand-* tokens.
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
        <svg xmlns="http://www.w3.org/2000/svg" viewBox={`0 0 ${MARK_VIEWBOX} ${MARK_VIEWBOX}`} width="140" height="140">
          {MARK_LARGE.map((r) => (
            <rect key={`${r.part}-${r.x}-${r.y}`} x={r.x} y={r.y} width={r.width} height={r.height} rx={r.rx} fill={MARK_COLOURS.light[r.part]} />
          ))}
        </svg>
      </div>
    ),
    { ...size },
  );
}
