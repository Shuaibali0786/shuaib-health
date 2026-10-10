import { cn } from "@/lib/cn";
import { WORDMARK_COLOURS } from "@/lib/brand-marks";
import { LogoMark, type LogoMarkTone } from "./LogoMark";
import { WORDMARK_HEALTH_PATH, WORDMARK_SHUAIB_PATH, WORDMARK_VIEWBOX } from "./wordmark-paths";

type LogoSize = "sm" | "md" | "lg";

/**
 * - light: the default, on white or light backgrounds
 * - night: on dark backgrounds (cream body, deeper teal plus, white and light-teal wordmark)
 * - small: the sturdy drawing for 32 px and below; the light colours
 * - one-colour: print; body and rings navy, plus white
 * - auto: light, but every colour is read from the --logo-* CSS variables
 */
export type LogoVariant = "light" | "night" | "small" | "one-colour" | "auto";

interface LogoProps {
  variant?: LogoVariant;
  /** Show "Shuaib Health" beside the mark. Default true. */
  wordmark?: boolean;
  size?: LogoSize;
  className?: string;
}

/**
 * `font` is the equivalent type size in pixels (the wordmark is a drawing, so, like the mark, it does not
 * grow with the browser's text-size setting).
 * - "md" is the header logo, with three steps because the header row has to stay on one line: compact below
 *   640 px (logo, call icon, "Book" and menu button must fit at 320 to 430 px), full from 640 to 1279 px, and
 *   compact again from 1280 px, where the eight nav links, the phone and "Book Appointment" fill the row
 *   (about 175 px are left for the logo).
 * - "lg" is the footer logo: full size at every width.
 * The Tailwind classes are written out in full so Tailwind can find them; a wordmark's height is 0.77 x the
 * font size (its viewBox is 77 units tall at font size 100).
 */
const SIZES: Record<LogoSize, { mark: number; font: number; wide?: { mark: number; font: number }; wordClass: string; gap: string }> = {
  sm: { mark: 28, font: 20, wordClass: "h-[15.4px]", gap: "gap-2" },
  md: { mark: 32, font: 23, wide: { mark: 40, font: 32 }, wordClass: "h-[17.7px] sm:h-[24.6px] xl:h-[17.7px]", gap: "gap-1.5 sm:gap-2.5 xl:gap-1.5" },
  lg: { mark: 40, font: 32, wordClass: "h-[24.6px]", gap: "gap-2.5" },
};

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
  const metrics = SIZES[size];
  const tone = TONE_OF[variant];
  const small = variant === "small" ? true : undefined;
  const mark = metrics.wide ? (
    <>
      <span className="inline-flex sm:hidden xl:inline-flex">
        <LogoMark size={metrics.mark} tone={tone} small={small} />
      </span>
      <span className="hidden sm:inline-flex xl:hidden">
        <LogoMark size={metrics.wide.mark} tone={tone} small={small} />
      </span>
    </>
  ) : (
    <LogoMark size={metrics.mark} tone={tone} small={small} />
  );

  if (!wordmark) {
    return <span className={cn("inline-flex", className)}>{mark}</span>;
  }

  const { x, y, width, height } = WORDMARK_VIEWBOX;
  return (
    <span className={cn("inline-flex items-center", metrics.gap, className)}>
      {mark}
      <svg
        viewBox={`${x} ${y} ${width} ${height}`}
        className={cn("w-auto", metrics.wordClass)}
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
