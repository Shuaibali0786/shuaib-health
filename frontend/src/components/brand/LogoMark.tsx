import { useId } from "react";
import { LOGO_VIEWBOX, PLUS_PATH, PULSE_PATH, PULSE_STROKE_WIDTH } from "./logo-paths";

interface LogoMarkProps {
  /** Rendered width and height in pixels. */
  size?: number;
  className?: string;
}

/**
 * The Shuaib Health mark as inline SVG. Decorative: it is hidden from
 * assistive technology, and the surrounding link or wordmark carries the name.
 * Gradient colours come from the CSS tokens, so there are no hex values here.
 * Each instance gets its own gradient id, so the header and footer logos
 * never share an id.
 */
export function LogoMark({ size = 36, className }: LogoMarkProps) {
  const gradientId = useId();
  return (
    <svg
      viewBox={`0 0 ${LOGO_VIEWBOX} ${LOGO_VIEWBOX}`}
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" style={{ stopColor: "var(--color-teal-500)" }} />
          <stop offset="1" style={{ stopColor: "var(--color-navy-900)" }} />
        </linearGradient>
      </defs>
      <path d={PLUS_PATH} fill={`url(#${gradientId})`} />
      <path
        d={PULSE_PATH}
        fill="none"
        stroke="white"
        strokeWidth={PULSE_STROKE_WIDTH}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
