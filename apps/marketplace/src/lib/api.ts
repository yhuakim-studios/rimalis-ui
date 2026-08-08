import "server-only";

import { marketplace, type RequestContext } from "@rimalis/api-client";
import { apiConfig } from "./env";

/**
 * The app's entry point into `@rimalis/api-client`.
 *
 * ## Why this file exists at all
 *
 * `server-only`. Every API call in this app goes through here, so this one
 * import makes a browser-side call to rimalis-api a **build error** rather
 * than a launch-day discovery.
 *
 * That matters more than it sounds. The API's local `corsOrigins` allows
 * `localhost:5173`, so a `fetch` from a Client Component works perfectly in
 * development. Production `corsOrigins` is `[]`, so the same code fails
 * completely — with a CORS error in the browser console, at which point the
 * instinct is to widen CORS on the API and thereby delete the BFF boundary that
 * ADR-0003 exists to draw. Four lines here prevent that whole sequence.
 *
 * ## Public reads only, for now
 *
 * Nothing here takes a token. `publicCtx()` deliberately has no `accessToken`
 * field, so a Phase 1 page cannot accidentally make an authenticated request
 * with an empty token and get a confusing 401. Authenticated context arrives in
 * Phase 2 as a separate `authedCtx()`, which returns `null` rather than a
 * context when the session is expired — see ADR-0008 on why there is no
 * refresh-on-401 here.
 */

/**
 * Context for an unauthenticated request.
 *
 * A function rather than a constant so that `requestId` can be threaded in
 * later without changing every call site — the API honours an inbound
 * `x-request-id` and echoes it, which is what makes a browser request and our
 * server-to-server hop correlatable as two halves of one user action.
 */
export const publicCtx = (init?: { requestId?: string; signal?: AbortSignal }): RequestContext => ({
  config: apiConfig,
  ...(init?.requestId !== undefined ? { requestId: init.requestId } : {}),
  ...(init?.signal !== undefined ? { signal: init.signal } : {}),
});

/**
 * The catalogue endpoints, pre-bound to nothing — call them with `publicCtx()`.
 *
 * Re-exported rather than wrapped one function at a time: a wrapper per endpoint
 * would be twelve lines of pass-through that drift out of step with the client's
 * own signatures, and the client's doc comments are where the real warnings live
 * (`data` being `{ vendor, items }`, a malformed id being a 400, and so on).
 */
export const catalogue = marketplace;
