import { LogoMark, type LogoMarkTone } from "./LogoMark";
import { WORDMARK_COLOURS } from "@/lib/brand-marks";
import { WORDMARK_HEALTH_PATH, WORDMARK_SHUAIB_PATH, WORDMARK_VIEWBOX } from "./wordmark-paths";

type LogoSize = "sm" | "md" | "lg";

/**
 * - light: the default, on white or light backgrounds
 * - night: on dark backgrounds (cream body, deeper teal plus, white and light-teal wordmark)
 * - small: the sturdy drawing for 32 px and below; the light colours
 * - one-colour: print; body and rings navy, plus white
 * - auto: light, but every colour is read from the --logo-* CSS variables (the Command Centre switches them in Night theme)
 */
export type LogoVariant = "light" | "night" | "small" | "one-colour" | "auto";

interface LogoProps {
  variant?: LogoVariant;
  /** Show "Shuaib Health" beside the mark. Default true. */
  wordmark?: boolean;
  size?: LogoSize;
  className?: string;
}

// The wordmark height follows the mark: `font` is the equivalent type size in pixels (the wordmark is a
// drawing, so, like the mark, it does not grow with the browser's text-size setting; this keeps the header
// on one row at large text sizes).
const SIZES: Record<LogoSize, { mark: number; font: number }> = {
  sm: { mark: 28, font: 20 },
  md: { mark: 36, font: 23 },
  lg: { mark: 48, font: 34 },
};

// Inline styles, not utility classes: the Command Centre stylesheet only scans src/admin, so a shared component cannot rely on Tailwind classes.
const ROW = { display: "inline-flex", alignItems: "center" } as const;

const TONE_OF: Record<LogoVariant, LogoMarkTone> = {
  light: "light",
  night: "night",
  small: "light",
  "one-colour": "one-colour",
  auto: "auto",
};

function wordFill(word: "shuaib" | "health", variant: LogoVariant): string {
  if (variant === "auto") {
    return word === "shuaib" ? `var(--logo-word, ${WORDMARK_COLOURS.light.shuaib})` : `var(--logo-word-accent, ${WORDMARK_COLOURS.light.health})`;
  }
  return WORDMARK_COLOURS[TONE_OF[variant] as keyof typeof WORDMARK_COLOURS][word];
}

/**
 * The Booking Plus mark plus the "Shuaib Health" wordmark (Cormorant Garamond 700, drawn as outlines so
 * no font loads and the public pages never mention the admin display font). Everything is decorative SVG
 * and hidden from assistive technology: wrap the logo in a link and give that link its accessible
 * name, for example aria-label="Shuaib Health home".
 */
export function Logo({ variant = "light", wordmark = true, size = "md", className }: LogoProps) {
  const { mark, font } = SIZES[size];
  const symbol = <LogoMark size={mark} tone={TONE_OF[variant]} small={variant === "small" ? true : undefined} />;

  if (!wordmark) {
    return (
      <span className={className} style={ROW}>
        {symbol}
      </span>
    );
  }

  const scale = font / 100;
  return (
    <span className={className} style={{ ...ROW, gap: 8 }}>
      {symbol}
      <svg
        viewBox={`${WORDMARK_VIEWBOX.x} ${WORDMARK_VIEWBOX.y} ${WORDMARK_VIEWBOX.width} ${WORDMARK_VIEWBOX.height}`}
        width={Math.round(WORDMARK_VIEWBOX.width * scale * 10) / 10}
        height={Math.round(WORDMARK_VIEWBOX.height * scale * 10) / 10}
        aria-hidden="true"
        focusable="false"
        data-wordmark=""
      >
        <path d={WORDMARK_SHUAIB_PATH} style={{ fill: wordFill("shuaib", variant) }} />
        <path d={WORDMARK_HEALTH_PATH} style={{ fill: wordFill("health", variant) }} />
      </svg>
    </span>
  );
}
