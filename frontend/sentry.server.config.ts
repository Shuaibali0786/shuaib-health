import * as Sentry from "@sentry/nextjs";

import { scrubEvent } from "./src/lib/sentry-scrub";

// Server-side error reporting, off unless SENTRY_DSN is set. There is no browser SDK and no custom
// timer: on Vercel the SDK hands its flush to the platform's waitUntil. Every event is scrubbed first.
export function initServerSentry(): boolean {
  const dsn = process.env.SENTRY_DSN?.trim();
  if (!dsn) return false;
  Sentry.init({
    dsn,
    environment: process.env.VERCEL_ENV || process.env.NODE_ENV,
    release: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || undefined,
    // SDK 11 replaced sendDefaultPii with dataCollection: collect no user, cookie, header, query, body or
    // local-variable data at all. The scrubber below is a second layer for anything that still gets through.
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: false,
      httpBodies: [],
      urlQueryParams: false,
      databaseQueryData: false,
      queues: false,
      stackFrameVariables: false,
    },
    maxBreadcrumbs: 20,
    tracesSampleRate: 0.02,
    beforeSend: (event) => scrubEvent(event),
    beforeSendTransaction: (event) => scrubEvent(event),
  });
  return true;
}
