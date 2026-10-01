import Link from "next/link";
import type { ComponentPropsWithoutRef } from "react";
import { cn } from "@/lib/cn";

export type ButtonVariant = "primary" | "accent" | "outline" | "danger" | "onDark";

export type ButtonSize = "md" | "sm";

interface ButtonProps extends Omit<ComponentPropsWithoutRef<"a">, "href"> {
  href: string;
  variant?: ButtonVariant;
  /** "sm" is for tight spaces such as the header; both sizes keep a 44 px minimum height. */
  size?: ButtonSize;
  fullWidth?: boolean;
}

const SIZE_CLASS: Record<ButtonSize, string> = {
  md: "px-5 py-2.5 text-base",
  sm: "px-4 py-2 text-sm",
};

/**
 * Every pairing meets WCAG 2.2 AA (design-system.md §1):
 * primary white on navy-900, accent navy on light teal-sky gradient,
 * outline navy on white, danger white on danger-700, onDark navy on white.
 * No scale effect on press, so nothing moves under reduced motion.
 */
const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary: "bg-navy-900 text-white hover:bg-navy-800",
  accent: "bg-accent-gradient text-navy-900 hover:brightness-95",
  outline: "border-2 border-navy-900 bg-white text-navy-900 hover:bg-surface",
  danger: "bg-danger-700 text-white hover:brightness-90",
  onDark: "bg-white text-navy-900 hover:bg-teal-50",
};

const EXTERNAL = /^(tel:|mailto:|https?:)/;

/** A link styled as a button. Internal paths use next/link; tel:, mailto: and http(s) use a plain anchor. */
export function Button({
  href,
  variant = "primary",
  size = "md",
  fullWidth = false,
  className,
  children,
  ...props
}: ButtonProps) {
  const classes = cn(
    "inline-flex min-h-11 items-center justify-center gap-2 rounded-control font-semibold transition-colors duration-150",
    SIZE_CLASS[size],
    VARIANT_CLASS[variant],
    fullWidth && "w-full",
    className,
  );

  if (EXTERNAL.test(href)) {
    const isWeb = href.startsWith("http");
    return (
      <a href={href} className={classes} {...(isWeb ? { rel: "noopener noreferrer" } : {})} {...props}>
        {children}
      </a>
    );
  }

  return (
    <Link href={href} className={classes} {...props}>
      {children}
    </Link>
  );
}
