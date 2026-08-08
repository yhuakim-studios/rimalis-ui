import "server-only";

import { parseBuildEnv, type BuildEnv } from "./env.schema";

/**
 * The validated environment, read exactly once.
 *
 * ## Why `server-only`
 *
 * `sessionSecret()` below returns the session key. A single
 * `import { sessionSecret } from "@/lib/env"` from a Client Component would
 * inline it into the browser bundle, and nothing about that would look wrong in
 * review — the import reads identically to every other import. `server-only`
 * turns it into a build error with a message that names the offending file.
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
 *
 * ## Why this is the BUILD schema, not the full one
 *
 * This module is not only imported by a running Worker. `api.ts` imports it,
 * every page imports `api.ts`, and `next build` evaluates all of them while it
 * collects page data — in a build container that has no `SESSION_SECRET` and no
 * `APP_ORIGIN`, because on Cloudflare those arrive at request time (a secret and
 * a `vars` entry respectively). A full parse here fails the build for variables
 * the build does not use, which is what broke CI immediately after
 * `next.config.ts` was fixed to stop doing the same thing.
 *
 * So the eager parse covers exactly what is safe to demand at build time, and
 * the two runtime-only values are read through the accessors below.
 */
export const env: BuildEnv = parseBuildEnv(process.env);

/**
 * The session key, validated on first use.
 *
 * A function rather than a constant because there is no single moment at which
 * both "this module was imported" and "we are serving a request" are true — the
 * build imports it too. Calling this from request-handling code gets the
 * fail-fast behaviour the constant used to provide, at the first moment the
 * value is actually needed and therefore actually knowable.
 *
 * The error names the fix, because the failure mode it replaces is a deploy
 * that goes green and then throws inside `jose` on the first login with a
 * message about key length.
 */
export function sessionSecret(): string {
  const value = env.SESSION_SECRET;
  if (value === undefined) {
    throw new Error(
      "SESSION_SECRET is not set in this environment. On Cloudflare, set it with `wrangler secret put SESSION_SECRET`; locally, add it to apps/marketplace/.env.local.",
    );
  }
  return value;
}

/**
 * This app's own public origin, validated on first use. See `sessionSecret()`
 * for why it is a function.
 */
export function appOrigin(): string {
  const value = env.APP_ORIGIN;
  if (value === undefined) {
    throw new Error(
      "APP_ORIGIN is not set in this environment. Set it in `vars` in apps/marketplace/wrangler.jsonc; locally, add it to apps/marketplace/.env.local.",
    );
  }
  return value;
}

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
