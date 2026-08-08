import "server-only";

import { parseEnv, type Env } from "./env.schema";

/**
 * The validated environment, read exactly once.
 *
 * ## Why `server-only`
 *
 * `SESSION_SECRET` is in this object. A single `import { env } from "@/lib/env"`
 * from a Client Component would inline it into the browser bundle, and nothing
 * about that would look wrong in review — the import reads identically to every
 * other import. `server-only` turns it into a build error with a message that
 * names the offending file.
 *
 * ## Why `NEXT_PUBLIC_API_URL` is not public
 *
 * The name is inherited from Part B's scaffold and is now actively misleading.
 * Under the BFF (ADR-0003) the browser NEVER calls rimalis-api: it calls this
 * app's route handlers and Server Actions, which call the API server-to-server.
 * A browser-side fetch to the API would also *appear* to work in development,
 * because the API's local `corsOrigins` allows `localhost:5173`, and then fail
 * completely in production, where `corsOrigins` is `[]`. That is a launch-day
 * bug hiding behind a green local test.
 *
 * Renaming the variable is a breaking change to a deployed template, so instead:
 * this module is the only reader, it is `server-only`, and so is every module
 * that touches it. The `NEXT_PUBLIC_` prefix means Next also inlines the value
 * at build time, which is harmless — an API origin is not a secret — but it is
 * NOT permission to call it from a browser.
 *
 * ## Read once, at module scope, on purpose
 *
 * Parsing per access would let a route handler observe a *different*
 * environment from the one the build validated. Parsing here means the first
 * import of this module in a Worker isolate either succeeds or fails the whole
 * isolate, which is the behaviour you want from configuration.
 */
export const env: Env = parseEnv(process.env);

/**
 * Config for `@rimalis/api-client`, assembled once from the same source.
 *
 * Here rather than at each call site so `baseUrl`/`basePath` cannot be passed
 * inconsistently — the two values only mean anything together.
 */
export const apiConfig = {
  baseUrl: env.NEXT_PUBLIC_API_URL,
  basePath: env.API_BASE_PATH,
} as const;

/**
 * Whether the catalogue should be served from local fixtures.
 *
 * The `NODE_ENV` half of this condition is load-bearing and must stay in the
 * SAME expression as the flag: it lets the bundler prove the branch is dead in
 * a production build and drop `await import("./fixtures")` entirely, so fixture
 * data never enters the Worker (which has a 10MB gzipped ceiling). Split across
 * two conditions, or read through a variable, and it no longer folds.
 *
 * Phase 0.5 seeded the API with 16 products across 5 vendors, so this is very
 * likely to stay `false` forever and be deleted in Phase 8. It exists as a
 * fallback, not a plan.
 */
export const useFixtures: boolean =
  env.MARKETPLACE_FIXTURES && process.env.NODE_ENV !== "production";
