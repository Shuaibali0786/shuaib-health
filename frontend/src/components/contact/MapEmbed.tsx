"use client";

import { MapPin } from "lucide-react";
import { useState } from "react";
import type { SiteConfig } from "@/types/content";

interface MapEmbedProps {
  mapArea: SiteConfig["mapArea"];
  address: string[];
}

/**
 * The general area on a map, shown only when the visitor asks for it. Until then the page makes no
 * request to any outside site, and the text address is always visible (FR-072). The area and the
 * address come from the clinic data.
 */
export function MapEmbed({ mapArea, address }: MapEmbedProps) {
  const [shown, setShown] = useState(false);
  const [west, south, east, north] = mapArea.bbox;
  const bbox = `${west},${south},${east},${north}`;
  /** OpenStreetMap's embed address: no account, no key, and no marker, so no real business is pinned. */
  const embedSrc = `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(bbox)}&layer=mapnik`;
  const openHref = `https://www.openstreetmap.org/?bbox=${encodeURIComponent(bbox)}&layers=M`;

  return (
    <div className="flex flex-col gap-3">
      <address className="not-italic text-base text-ink">
        {address.map((line) => (
          <span key={line} className="block">
            {line}
          </span>
        ))}
      </address>
      <p className="text-sm text-muted">Map shows the general area; the address is a sample.</p>

      {shown ? (
        <iframe
          title={`Map: ${mapArea.label}`}
          src={embedSrc}
          loading="lazy"
          referrerPolicy="no-referrer"
          sandbox="allow-scripts allow-same-origin"
          className="h-72 w-full rounded-card border border-border md:h-96"
        />
      ) : (
        <div className="flex flex-col items-start gap-3 rounded-card border border-border bg-surface p-5">
          <MapPin className="size-6 text-teal-700" aria-hidden="true" />
          <p className="text-sm text-muted">Showing the map contacts OpenStreetMap.</p>
          <button
            type="button"
            onClick={() => setShown(true)}
            className="inline-flex min-h-11 items-center justify-center rounded-control border-2 border-navy-900 bg-white px-5 py-2.5 text-base font-semibold text-navy-900 transition-colors hover:bg-surface"
          >
            Show map
          </button>
        </div>
      )}

      <a href={openHref} target="_blank" rel="noopener noreferrer" className="self-start text-base font-semibold text-teal-700 underline underline-offset-2">
        Open this area in OpenStreetMap
        <span className="sr-only"> (opens in a new tab)</span>
      </a>
    </div>
  );
}
