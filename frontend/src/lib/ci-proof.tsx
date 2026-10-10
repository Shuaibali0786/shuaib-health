import { useState } from "react";

export function CiProof({ on }: { on: boolean }) {
  if (on) {
    useState(0);
  }
  return null;
}
