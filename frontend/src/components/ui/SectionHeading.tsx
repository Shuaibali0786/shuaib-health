import { cn } from "@/lib/cn";

interface SectionHeadingProps {
  /** Becomes the h2 id; pass the same value to Section's `labelledBy`. */
  id: string;
  title: string;
  eyebrow?: string;
  intro?: string;
  align?: "left" | "center";
  /** "dark" is for navy gradient bands: white heading, teal-300 eyebrow. */
  tone?: "light" | "dark";
  className?: string;
}

/** Optional eyebrow, an h2, and an optional intro line. */
export function SectionHeading({
  id,
  title,
  eyebrow,
  intro,
  align = "left",
  tone = "light",
  className,
}: SectionHeadingProps) {
  const dark = tone === "dark";
  return (
    <div className={cn("max-w-2xl", align === "center" && "mx-auto text-center", className)}>
      {eyebrow ? (
        <p
          className={cn(
            "mb-2 text-[0.8125rem] font-semibold uppercase tracking-[0.08em]",
            dark ? "text-teal-300" : "text-teal-700",
          )}
        >
          {eyebrow}
        </p>
      ) : null}
      <h2 id={id} className={cn("text-[1.75rem] font-bold md:text-4xl", dark && "text-white")}>
        {title}
      </h2>
      {intro ? <p className={cn("mt-3 text-base", dark ? "text-white" : "text-muted")}>{intro}</p> : null}
    </div>
  );
}
