"use client";

import { MapPin } from "lucide-react";
import { useState } from "react";
import { siteConfig } from "@/data/siteConfig";

const [WEST, SOUTH, EAST, NORTH] = siteConfig.mapArea.bbox;
const BBOX = `${WEST},${SOUTH},${EAST},${NORTH}`;
/** OpenStreetMap's embed address: no account, no key, and no marker, so no real business is pinned. */
const EMBED_SRC = `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(BBOX)}&layer=mapnik`;
const OPEN_HREF = `https://www.openstreetmap.org/?bbox=${encodeURIComponent(BBOX)}&layers=M`;

/**
 * The general Karachi area on a map, shown only when the visitor asks for it. Until then the page
 * makes no request to any outside site, and the text address is always visible (FR-072).
 */
export function MapEmbed() {
  const [shown, setShown] = useState(false);

  return (
    <div className="flex flex-col gap-3">
      <address className="not-italic text-base text-ink">
        {siteConfig.address.map((line) => (
          <span key={line} className="block">
            {line}
          </span>
        ))}
      </address>
      <p className="text-sm text-muted">Map shows the general area; the address is a sample.</p>

      {shown ? (
        <iframe
          title="Map of the general Karachi area"
          src={EMBED_SRC}
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

      <a href={OPEN_HREF} target="_blank" rel="noopener noreferrer" className="self-start text-base font-semibold text-teal-700 underline underline-offset-2">
        Open this area in OpenStreetMap
        <span className="sr-only"> (opens in a new tab)</span>
      </a>
    </div>
  );
}
