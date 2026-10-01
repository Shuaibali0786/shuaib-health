import type { ComponentPropsWithoutRef, ElementType } from "react";
import { cn } from "@/lib/cn";

type CardProps<T extends ElementType> = {
  as?: T;
  /** Adds the hover lift. The lift is motion-safe: it never moves under reduced motion. */
  interactive?: boolean;
} & Omit<ComponentPropsWithoutRef<T>, "as">;

/** Rounded card with a soft shadow and a hairline border. */
export function Card<T extends ElementType = "div">({ as, interactive = false, className, ...props }: CardProps<T>) {
  const Component: ElementType = as ?? "div";
  return (
    <Component
      className={cn(
        "relative rounded-card border border-border bg-white shadow-soft",
        interactive &&
          cn(
            "transition-shadow duration-200 hover:shadow-lift motion-safe:transition-[box-shadow,transform] motion-safe:hover:-translate-y-0.5",
            // Keyboard focus on the card's link outlines the whole card instead of just the link text.
            "has-[a:focus-visible]:outline-2 has-[a:focus-visible]:outline-offset-2 has-[a:focus-visible]:outline-blue-700 [&_a:focus-visible]:outline-transparent",
          ),
        className,
      )}
      {...props}
    />
  );
}
