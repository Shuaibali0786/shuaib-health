"use client";

import Image from "next/image";
import { useState } from "react";
import { cn } from "@/lib/cn";
import type { ImageAsset } from "@/types/content";

interface ImageWithFallbackProps {
  image: ImageAsset;
  sizes: string;
  /** Only the hero image sets this; everything else lazy loads. */
  priority?: boolean;
  className?: string;
}

/**
 * next/image with explicit width and height (no layout shift). If the file
 * fails to load, a neutral block of the same aspect ratio shows the alt text
 * as a caption instead of a broken-image icon.
 */
export function ImageWithFallback({ image, sizes, priority = false, className }: ImageWithFallbackProps) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div
        className={cn("flex w-full items-center justify-center bg-surface p-4 text-center text-sm text-muted", className)}
        style={{ aspectRatio: `${image.width} / ${image.height}` }}
      >
        <span>{image.alt}</span>
      </div>
    );
  }

  return (
    <Image
      src={image.src}
      alt={image.alt}
      width={image.width}
      height={image.height}
      sizes={sizes}
      // The hero is in the first bytes of HTML, so the browser finds it at once. Next's docs prefer
      // eager loading plus a high fetch priority over `preload`, which adds a separate
      // <link rel="preload"> tag with no href (the only unusual preload on the page).
      loading={priority ? "eager" : undefined}
      fetchPriority={priority ? "high" : undefined}
      style={{ aspectRatio: `${image.width} / ${image.height}` }}
      className={cn("h-auto w-full", className)}
      onError={() => setFailed(true)}
      // An image that failed before hydration never fires onError; catch that case here.
      ref={(node) => {
        if (node && node.complete && node.naturalWidth === 0) setFailed(true);
      }}
    />
  );
}
