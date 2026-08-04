/**
 * The typed client for digistore-api.
 *
 * **This is the reason the three apps live in one repository.** Three separate
 * repos would each carry their own copy of the JWT refresh/rotation logic, and
 * for a solo maintainer that is where multi-repo setups rot — the copies drift,
 * and the one that drifts is the one you weren't looking at. See ADR-0001.
 *
 * ## Layout
 *
 *   config.ts       where the API is; `buildUrl`
 *   result.ts       the `Result` union every method returns
 *   http.ts         the ONE `fetch` — timeout, retry policy, envelope branch
 *   marketplace.ts  the public catalogue
 *
 * `auth`, `orders`, `payments` and `users` land with the phases that use them.
 *
 * ---
 *
 * ## Read ADR-0003 before adding auth calls here
 *
 * The browser never calls this API directly. Each Next.js app is a **BFF**: the
 * browser posts to that app's own route handler, which calls digistore-api
 * server-to-server and sets an `httpOnly; Secure; SameSite=Strict` cookie
 * scoped to **that one subdomain**.
 *
 * Three consequences for whoever writes the rest of the client:
 *
 * - This module runs **server-side**, inside route handlers, Server Actions and
 *   Server Components. Do not reach for `localStorage`, `document.cookie` or
 *   `window` — none of them exist where this code runs, and the whole point of
 *   the BFF is that the token never reaches anywhere they could read it.
 * - **Never scope the session cookie to `.<domain>`.** A parent-domain cookie is
 *   readable by every subdomain and silently undoes the marketplace / vendor /
 *   admin session separation that three subdomains exist to provide. This is the
 *   single easiest way to quietly break the security model.
 * - **The access token is a per-request argument, never module state.** See the
 *   comment on `RequestContext.accessToken` in `http.ts`: a Worker isolate
 *   serves concurrent requests from different users, so a module-level token is
 *   a cross-user session leak that works flawlessly in local development.
 */

export * from "./config";
export * from "./result";
export * from "./http";
export * as marketplace from "./marketplace";

/** Re-exported so consumers need only one import for the common case. */
export type { ApiResponse } from "@digistore/types";
