import type { ComponentPropsWithoutRef } from "react";
import { cn } from "@/lib/cn";

/** Page-width wrapper: max 75rem, 1rem side padding on phones, 1.5rem from md, 2rem from xl. */
export function Container({ className, ...props }: ComponentPropsWithoutRef<"div">) {
  return <div className={cn("mx-auto w-full max-w-page px-4 md:px-6 xl:px-8", className)} {...props} />;
}
