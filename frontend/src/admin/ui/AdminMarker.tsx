"use client";

import { __SH_COMMAND_CENTRE__ } from "@/admin/marker";

/** Puts the marker into the admin client bundle (see marker.ts). Renders an inert, hidden element. */
export function AdminMarker() {
  return <span hidden data-cc={__SH_COMMAND_CENTRE__} />;
}
