import "server-only";

import { parseBuildEnv, type BuildEnv } from "./env.schema";

/**
 * The validated environment, read exactly once.
 *
 * ## Why `server-only`
 *
 * `sessionSecret()` below returns the key that encrypts the session cookie. A
 * single `import { sessionSecret } from "@/lib/env"` from a Client Component
 * would inline it into the browser bundle, and nothing about that would look
 * wrong in review — the import reads identically to every other import.
 * `server-only` turns it into a build error that names the offending file.
 *
 * ## Why `NEXT_PUBLIC_API_URL` is not public
 *
 * The prefix is inherited from the scaffold and is actively misleading. Under
 * the BFF (ADR-0003) the browser NEVER calls rimalis-api: it calls this app's
 * own route handlers and Server Actions, which call the API server-to-server.
 * A browser-side fetch would also *appear* to work in development, because the
 * API's local `corsOrigins` allows `localhost:5174`, and then fail completely in
 * production, where `corsOrigins` is `[]`.
 *
 * That failure mode is worst of all here. EVERY call this app makes is
 * ADMIN-authenticated, so a browser-side fetch would need an admin access token
 * in the browser — the one credential on the platform that can suspend a vendor,
 * change a role or reprice the catalogue. The BFF exists to keep it server-side.
 *
 * ## Why this is the BUILD schema, not the full one
 *
 * This module is not only imported by a running Worker. `auth.ts` imports it,
 * every page imports `auth.ts`, and `next build` evaluates all of them while it
 * collects page data — in a build container that has no `SESSION_SECRET`,
 * because on Cloudflare that is a Worker secret injected at request time. A full
 * parse here fails the build for a variable the build does not use. See
 * `env.schema.ts`, and the marketplace commit that fixed the same bug there.
 */
export const env: BuildEnv = parseBuildEnv(process.env);

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
 * The session key, validated on first use.
 *
 * A function rather than a constant because there is no single moment at which
 * both "this module was imported" and "we are serving a request" are true — the
 * build imports it too. Calling this from request-handling code gets the
 * fail-fast behaviour a constant used to provide, at the first moment the value
 * is actually needed and therefore actually knowable.
 */
export function sessionSecret(): string {
  const value = env.SESSION_SECRET;
  if (value === undefined) {
    throw new Error(
      "SESSION_SECRET is not set in this environment. On Cloudflare, set it with `wrangler secret put SESSION_SECRET` from apps/admin; locally, add it to apps/admin/.env.local.",
    );
  }
  return value;
}
