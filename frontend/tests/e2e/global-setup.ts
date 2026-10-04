import { scanClientBundles } from "../unit/helpers/client-bundle-scan";

/** Runs after the e2e production build is up: the API address must not be in any browser bundle (SC-006). */
export default function globalSetup() {
  const { hits } = scanClientBundles();
  if (hits.length > 0) throw new Error(`The catalog API address or settings leaked into browser bundles:\n${hits.join("\n")}`);
}
