import {
  MARK_COLOURS,
  MARK_LARGE,
  MARK_SMALL,
  MARK_VIEWBOX,
  SMALL_MARK_MAX_PX,
  WATERMARK_COLOURS,
  type MarkPart,
  type MarkTone,
} from "@/lib/brand-marks";

/** "auto" reads --logo-body / --logo-rings / --logo-plus from CSS, so a stylesheet (the Command Centre's Night theme) can recolour it. */
export type LogoMarkTone = MarkTone | "auto" | "watermark";

interface LogoMarkProps {
  /** Rendered width and height in pixels. At 32 px and below the sturdier SMALL drawing is used. */
  size?: number;
  tone?: LogoMarkTone;
  /** Force the SMALL (true) or the default (false) drawing; by default it follows `size`. */
  small?: boolean;
  className?: string;
}

/** The fill of one part: a colour, or for "auto" a CSS variable that falls back to the light colour. */
function fillOf(part: MarkPart, tone: LogoMarkTone): string {
  if (tone === "auto") return `var(--logo-${part}, ${MARK_COLOURS.light[part]})`;
  return tone === "watermark" ? WATERMARK_COLOURS[part] : MARK_COLOURS[tone][part];
}

/**
 * The Booking Plus mark as inline SVG. Decorative: it is hidden from assistive technology, and the
 * surrounding link (aria-label "Shuaib Health home") or heading carries the name.
 */
export function LogoMark({ size = 36, tone = "light", small, className }: LogoMarkProps) {
  const rects = (small ?? size <= SMALL_MARK_MAX_PX) ? MARK_SMALL : MARK_LARGE;
  return (
    <svg
      viewBox={`0 0 ${MARK_VIEWBOX} ${MARK_VIEWBOX}`}
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      {rects.map((r) => (
        <rect key={`${r.part}-${r.x}-${r.y}`} x={r.x} y={r.y} width={r.width} height={r.height} rx={r.rx} style={{ fill: fillOf(r.part, tone) }} />
      ))}
    </svg>
  );
}
