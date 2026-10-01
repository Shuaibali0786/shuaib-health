import type { ComponentPropsWithoutRef } from "react";
import { cn } from "@/lib/cn";

interface ContainerProps extends ComponentPropsWithoutRef<"div"> {
  /** 80rem instead of 75rem. Used by the header only. */
  wide?: boolean;
}

/** Page-width wrapper: max 75rem, 1rem side padding on phones, 1.5rem from md, 2rem from xl. */
export function Container({ wide = false, className, ...props }: ContainerProps) {
  return (
    <div className={cn("mx-auto w-full px-4 md:px-6 xl:px-8", wide ? "max-w-wide" : "max-w-page", className)} {...props} />
  );
}
