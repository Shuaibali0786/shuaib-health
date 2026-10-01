import { cn } from "@/lib/cn";
import { LogoMark } from "./LogoMark";

type LogoSize = "sm" | "md" | "lg";

interface LogoProps {
  /** "mark" is the symbol only. */
  variant?: "full" | "mark";
  size?: LogoSize;
  /** For navy backgrounds: white "Shuaib", teal-300 "Health", and the mark on a white tile. */
  onDark?: boolean;
  className?: string;
}

const SIZES: Record<LogoSize, { mark: number; text: string }> = {
  sm: { mark: 28, text: "text-lg" },
  md: { mark: 36, text: "text-xl" },
  lg: { mark: 48, text: "text-3xl" },
};

/**
 * Mark plus wordmark: "Shuaib" in navy and "Health" in teal-600 (a logotype is
 * exempt from text contrast rules; teal-600 is still at least 3:1 on white).
 * The wordmark is real text. Wrap the logo in a link and give that link its
 * accessible name, for example aria-label="Shuaib Health home".
 */
export function Logo({ variant = "full", size = "md", onDark = false, className }: LogoProps) {
  const { mark, text } = SIZES[size];
  const symbol = onDark ? (
    <span className="inline-flex rounded-control bg-white p-1">
      <LogoMark size={mark} />
    </span>
  ) : (
    <LogoMark size={mark} />
  );

  if (variant === "mark") {
    return <span className={cn("inline-flex", className)}>{symbol}</span>;
  }

  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      {symbol}
      <span className={cn("font-heading font-extrabold leading-none tracking-tight", text)}>
        <span className={onDark ? "text-white" : "text-navy-900"}>Shuaib</span>
        <span className={onDark ? "text-teal-300" : "text-teal-600"}>Health</span>
      </span>
    </span>
  );
}
