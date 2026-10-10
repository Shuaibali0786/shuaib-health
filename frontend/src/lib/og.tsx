import { ImageResponse } from "next/og";
import { MARK_COLOURS, MARK_LARGE, MARK_VIEWBOX } from "@/lib/brand-marks";
import { DEMO_NOTICE } from "@/lib/honesty";

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
 * (navy-900 and teal-700 from tokens.css; the mark's colours come from brand-marks.ts); tests/unit/tokens.test.ts checks they match.
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
        <svg xmlns="http://www.w3.org/2000/svg" viewBox={`0 0 ${MARK_VIEWBOX} ${MARK_VIEWBOX}`} width="200" height="200">
          {MARK_LARGE.map((r) => (
            <rect key={`${r.part}-${r.x}-${r.y}`} x={r.x} y={r.y} width={r.width} height={r.height} rx={r.rx} fill={MARK_COLOURS.light[r.part]} />
          ))}
        </svg>
        <div style={{ display: "flex", flexDirection: "column", marginLeft: 56, maxWidth: 800 }}>
          {eyebrow ? <div style={{ fontSize: 32, fontWeight: 700, color: "#0F766E" }}>{eyebrow}</div> : null}
          <div style={{ fontSize: title.length > 40 ? 56 : 76, fontWeight: 800, marginTop: 8, lineHeight: 1.1 }}>{title}</div>
          {subtitle ? <div style={{ fontSize: 36, marginTop: 16 }}>{subtitle}</div> : null}
          <div style={{ fontSize: 26, marginTop: 36, color: "#0F766E" }}>{DEMO_NOTICE}</div>
        </div>
      </div>
    ),
    { ...OG_SIZE },
  );
}
