import * as z from "zod";

// Zod probes for eval support with `new Function("")` the moment a schema is built, and the CSP reports that
// harmless probe as a violation. jitless skips it, but only if it is set BEFORE any schema is created, so
// every file that builds schemas for the browser imports this module first (a side-effect import).
z.config({ jitless: true });
